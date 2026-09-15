// Copyright (C) 2025 Acoustic, L.P. All rights reserved.
//
// NOTICE: This file contains material that is confidential and proprietary to
// Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
// industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
// Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
// prohibited.
//
//
//  Created on 5/9/25.
//

import Foundation
import Connect
import NitroModules
import OSLog
// Explicit, though `Connect`'s umbrella header pulls it in transitively:
// `logScreenLayout` resolves the top view controller itself, so this file has a
// first-hand dependency on UIApplication / UIWindowScene / UIViewController.
import UIKit

// Two loggers under one subsystem so developers can filter Console.app / Xcode
// output by category. `config` covers anything about reading and validating
// `AcousticConnectRNConfig.bundle`; `bridge` covers SDK lifecycle calls
// (`enable`, `disable`, the resolved-config summary line).
private let configLog = Logger(subsystem: "com.acoustic.AcousticConnectRN", category: "config")
private let bridgeLog = Logger(subsystem: "com.acoustic.AcousticConnectRN", category: "bridge")

// Small descriptor on `ConnectPushConfig` so the bridge can log "off" /
// "automatic" / "manual" without round-tripping through the JS-side enum.
private extension ConnectPushConfig {
    var modeDescription: String {
        switch self.mode {
        case .off:       return "off"
        case .automatic: return "automatic"
        case .manual:    return "manual"
        @unknown default: return "unknown"
        }
    }
}

// Single compat entry point for the config-item store. Works against every
// shipping iOS SDK variant (Release with separate EOCore/Tealeaf, current merged
// Debug 2.1.2, future merged-only) because `ConnectApplicationHelper` ships with
// each of them. Not importing `EOCore`/`Tealeaf` avoids a link dependency on
// frameworks that aren't always packaged into the app bundle.
private enum ConnectConfigStore {
    @discardableResult
    static func set(_ key: String, value: Any) -> Bool {
        return ConnectApplicationHelper.sharedInstance().setConfigurableItem(key, value: value)
    }

    static func bool(forKey key: String, default def: Bool) -> Bool {
        let raw = ConnectApplicationHelper.sharedInstance().value(forConfigurableItem: key)
        if let n = raw as? NSNumber { return n.boolValue }
        if let s = raw as? String   { return (s as NSString).boolValue }
        return def
    }

    static func string(forKey key: String, default def: String) -> String? {
        return (ConnectApplicationHelper.sharedInstance().value(forConfigurableItem: key) as? String) ?? def
    }

    static func number(forKey key: String, default def: Double) -> Double {
        return (ConnectApplicationHelper.sharedInstance().value(forConfigurableItem: key) as? NSNumber)?.doubleValue ?? def
    }

    /// Reads a config item back as a dictionary. Used for `AutoLayout`, which
    /// the native SDK populates from its own bundled `ConnectLayoutConfig.json`
    /// and which `applyConnectConfig` then overrides from `ConnectConfig.json`
    /// — so this returns the *effective* block either way.
    static func dictionary(forKey key: String) -> [String: Any]? {
        return ConnectApplicationHelper.sharedInstance().value(forConfigurableItem: key) as? [String: Any]
    }
}

// MARK: - Push adapter wrappers

/// Bridges a JS-supplied `userInfo` dictionary to the SDK's `ConnectNotification`
/// protocol (a single `userInfo` requirement).
private struct HybridAcousticConnectNotification: ConnectNotification {
    let userInfo: [AnyHashable: Any]

    init(userInfo: [String: Any]) {
        self.userInfo = userInfo.reduce(into: [AnyHashable: Any]()) { $0[$1.key] = $1.value }
    }
}

/// Bridges a JS-supplied response to the SDK's `ConnectNotificationResponse`
/// protocol (`actionIdentifier` + `userInfo`).
private struct HybridAcousticConnectNotificationResponse: ConnectNotificationResponse {
    let actionIdentifier: String
    let userInfo: [AnyHashable: Any]

    init(actionIdentifier: String, userInfo: [String: Any]) {
        self.actionIdentifier = actionIdentifier
        self.userInfo = userInfo.reduce(into: [AnyHashable: Any]()) { $0[$1.key] = $1.value }
    }
}

class HybridAcousticConnectRN: HybridAcousticConnectRNSpec {

    /// Push mode resolved from `ConnectConfig.json` at `load()` time. The push
    /// bridge methods branch on this synchronously rather than calling into the
    /// `@MainActor` SDK to detect mode (mirrors the Android bridge): manual mode
    /// forwards events to the SDK; automatic/off surface `EAC-RN-007` (`false`).
    ///

    /// Whether `ConnectConfig.json` supplied an `AutoLayout` block.
    ///
    /// It decides where a defaulted capture delay comes from. When the consumer
    /// configured layout, their `CaptureLayoutDelay` is authoritative — whatever
    /// they wrote, including `0`. When they configured none, the config store
    /// still answers, but with the native SDK's own bundled
    /// `ConnectLayoutConfig.json` — and that value (1 ms) is tuned for the
    /// UIKit trigger, which fires *after* the transition. React Navigation
    /// triggers capture *before* it, so inheriting 1 ms there reproduces the
    /// mid-transition capture this indirection exists to avoid, and diverges
    /// from Android, whose bundled default is 500 ms. No consumer block
    /// therefore means the wrapper's own default applies.
    ///
    /// That also excludes the *per-screen* rules in the SDK's bundled config,
    /// deliberately: they are keyed by UIKit view-controller class names from
    /// the SDK's own sample app (`StartViewController`, `WEWKWebViewController`
    /// …) and cannot match a React Navigation route name, and there is no
    /// supported way to add per-screen rules on iOS except through
    /// `ConnectConfig.json` — the pod rewrites its bundled copy on every `pod
    /// install`. So nothing reachable is being dropped.
    ///
    /// Resolved in `init` rather than in `load()`, which is where the rest of
    /// the config is applied: `load()` runs on the main actor, so resolving it
    /// there would leave a startup window in which this read as `false` and a
    /// capture silently ignored a configured delay. `init` closes that window —
    /// JS cannot reach a bridge method before the constructor returns.
    private let consumerSuppliedAutoLayout: Bool

    // Constructor — auto-inits the SDK from `ConnectConfig.json`. Matches the
    // pre-existing auto-init behaviour; consumers that need consent-gated init can call
    // `disable()` immediately and `enable()` once they have permission.
    override init() {
        self.consumerSuppliedAutoLayout =
            ConnectRNParsing.suppliesAutoLayout(Self.parseConnectConfigJSON() ?? [:])

        super.init()

        Task { @MainActor [weak self] in
            self?.load()
        }

        bridgeLog.info("HybridAcousticConnectRN constructed; load() dispatched on main actor.")
    }

    // `load()` calls into the MainActor-isolated `ConnectSDK.shared` API.
    // Marking the method `@MainActor` means Swift can verify the SDK calls
    // without an inner dispatch, and it makes the contract explicit for any
    // future caller.
    @MainActor
    func load() {
        let connectData = Self.parseConnectConfigJSON()

        guard let connectData = connectData else {
            configLog.error("AcousticConnectRNConfig.bundle missing or unreadable. SDK not initialised. Verify ConnectConfig.json at your project root and re-run `pod install`.")
            return
        }
        configLog.info("Read AcousticConnectRNConfig.bundle (\(connectData.count) top-level keys).")

        let appKey  = (connectData["AppKey"]         as? String) ?? ""
        let postURL = (connectData["PostMessageUrl"] as? String) ?? ""

        // Skip enable entirely if the consumer's config didn't reach us —
        // proceeding with empty strings would let the SDK silently fall back
        // to its bundled demo collector, which is exactly the bug this flow
        // is designed to prevent. Most likely cause: missing or malformed
        // ConnectConfig.json at the consumer's project root, or `pod install`
        // didn't run after the file was added.
        guard !appKey.isEmpty, !postURL.isEmpty else {
            configLog.error("SDK NOT ENABLED — empty AppKey or PostMessageUrl. Verify ConnectConfig.json at your project root contains both fields, then re-run `pod install`.")
            return
        }

        // Log every field the bridge consumes so the developer can see in
        // Xcode / Console.app exactly what's in effect, without cross-checking
        // ConnectConfig.json.
        configLog.info("AppKey: \(appKey, privacy: .public) (length=\(appKey.count))")
        configLog.info("PostMessageUrl: \(postURL, privacy: .public)")
        if let killSwitch = connectData["KillSwitchUrl"] as? String, !killSwitch.isEmpty {
            configLog.info("KillSwitchUrl: \(killSwitch, privacy: .public)")
        }

        let pushConfig = ConnectRNParsing.resolvePushConfig(from: connectData)

        // Non-release integrations (useRelease:false — the AcousticConnectDebug
        // SDK variant) turn on the Connect/Tealeaf/EOCore verbose native logging
        // so it surfaces in the Xcode console / Console.app for QA and support.
        // Must be set before enable() below: EOCore reads `EODebug` from the
        // process environment and caches it on the first log call. overwrite=0
        // leaves any value the host already set (e.g. an Xcode scheme) intact,
        // so a consumer can force it off with CONNECT_DEBUG=0. Release builds
        // (useRelease:true) stay quiet.
        let useRelease = (connectData["useRelease"] as? Bool) ?? false
        if !useRelease {
            setenv("CONNECT_DEBUG", "1", 0)
            setenv("TLF_DEBUG", "1", 0)
            setenv("EODebug", "1", 0)
            bridgeLog.info("useRelease=false — enabled verbose native SDK logging (CONNECT_DEBUG/TLF_DEBUG/EODebug)")
        }

        let sdk = ConnectSDK.shared
        bridgeLog.info("Calling ConnectSDK.shared.enable(with: ConnectConfig(push: \(pushConfig.modeDescription, privacy: .public)))")
        sdk.enable(with: ConnectConfig(appKey: appKey, postURL: postURL, push: pushConfig))
        _ = sdk.setReactNative(true, wrapNavigationContainer: true)

        // Apply remaining programmatic overrides (everything other than the
        // two enable parameters) AFTER enable — matches the order in the SDK's
        // own ConnectSDK.shared.enable(with:) implementation.
        self.applyConnectConfig(connectData)

        bridgeLog.info("SDK initialised: appKey length=\(appKey.count), push=\(pushConfig.modeDescription, privacy: .public), isReactNative=true, wrapNavigationContainer=true")
    }

    // Push-config resolution and the PushEnabled / iOSPushMode parsers moved
    // to ConnectRNParsing (behaviour-preserving extraction) so
    // they are unit-testable without constructing this hybrid.

    /// Reads and returns the `Connect` dictionary from the bundled
    /// `AcousticConnectRNConfig.json`. The bundle is populated at pod install
    /// time by the podspec — see `AcousticConnectRN.podspec`. Returns nil when
    /// the bundle or file is missing; callers fall back to empty values.
    private static func parseConnectConfigJSON() -> [String: Any]? {
        let bundle = Bundle(for: Self.self)
        let bundleURL = bundle.resourceURL?.appendingPathComponent("AcousticConnectRNConfig.bundle")
        let resourceBundle = bundleURL.flatMap { Bundle(url: $0) }
        let path = resourceBundle?.path(forResource: "AcousticConnectRNConfig", ofType: "json")
        let data = path.flatMap { try? Data(contentsOf: URL(fileURLWithPath: $0)) }
        let jsonData = data.flatMap { try? JSONSerialization.jsonObject(with: $0, options: []) as? [String: Any] }
        return jsonData?["Connect"] as? [String: Any]
    }
    
    /// Applies every recognised key from the parsed `Connect` config as a
    /// programmatic override. Called by `load()` AFTER enable so values land on
    /// a fully-initialised SDK. AppKey and PostMessageUrl are skipped here —
    /// they're passed to enable directly because the SDK's bundle-read
    /// short-circuits `tempConfigDict` for those two specifically.
    private func applyConnectConfig(_ connectData: [String: Any]) {
        let eocoreKeys = [
            "CachingLevel", "DoPostAppComesFromBackground", "DoPostAppGoesToBackground", "DoPostAppGoesToClose",
            "DoPostAppIsLaunched", "DoPostOnIntervals", "DynamicConfigurationEnabled", "HasToPersistLocalCache",
            "LoggingLevel", "ManualPostEnabled", "PostMessageLevelCellular", "PostMessageLevelWiFi",
            "PostMessageTimeIntervals", "CachedFileMaxBytesSize", "CompressPostMessage", "DefaultOrientation",
            "LibraryVersion", "MaxNumberOfFilesToCache", "MessageVersion", "PostMessageMaxBytesSize",
            "PostMessageTimeout", "TurnOffCorrectOrientationUpdates"
        ]

        let tealeafKeys = [
            "AppKey", "DisableAutoInstrumentation", "GetImageDataOnScreenLayout", "JavaScriptInjectionDelay",
            "KillSwitchEnabled", "KillSwitchMaxNumberOfTries", "KillSwitchTimeInterval", "KillSwitchTimeout",
            "KillSwitchUrl", "UseWhiteList", "WhiteListParam", "LogLocationEnabled", "MaxStringsLength",
            "PercentOfScreenshotsSize", "PercentToCompressImage", "ScreenShotPixelDensity", "PostMessageUrl",
            "DoPostOnScreenChange", "printScreen", "ScreenshotFormat", "SessionTimeout", "SessionizationCookieName",
            "CookieSecure", "disableTLTDID", "SetGestureDetector", "AddGestureRecognizerUIButton",
            "AddGestureRecognizerUIDatePicker", "AddGestureRecognizerUIPageControl", "AddGestureRecognizerUIPickerView",
            "AddGestureRecognizerUIScrollView", "AddGestureRecognizerUISegmentedControl", "AddGestureRecognizerUISwitch",
            "AddGestureRecognizerUITextView", "AddGestureRecognizerWKWebView", "AddMessageTypeHeader",
            "DisableAlertAutoCapture", "DisableAlertBackgroundForDisabledLogViewLayout", "DisableKeyboardCapture",
            "EnableWebViewInjectionForDisabledAutoCapture", "FilterMessageTypes", "InitialZIndex", "IpPlaceholder",
            "LibraryVersion", "LogFullRequestResponsePayloads", "LogViewLayoutOnScreenTransition", "MessageTypeHeader",
            "MessageTypes", "RemoveIp", "RemoveSwiftUIDuplicates", "SubViewArrayZIndexIncrementTrigger",
            "SwiftUICaptureNonVariadic", "TextFieldBeingEditedUseSender", "TreatJsonDictionariesAsString", "UICPayload",
            "UIKeyboardCaptureTouches", "UseJPGForReplayImagesExtension", "UseXpathId", "actionSheet:buttonIndex",
            "actionSheet:show", "alertView:buttonIndex", "alertView:show", "autolog:pageControl",
            "autolog:textBox:_searchFieldEndEditing", "button:click", "button:load", "canvas:click", "connection",
            "customEvent", "datePicker:dateChange", "exception", "gestures", "label:load", "label:textChange", "layout",
            "location", "mobileState", "orientation", "pageControl:valueChanged", "pickerView:valueChanged",
            "screenChangeLevel", "scroller:scrollChange", "selectList:UITableViewSelectionDidChangeNotification",
            "selectList:load", "selectList:valueChange", "slider:valueChange", "stepper:valueChange",
            "textBox:_searchFieldBeginChanged", "textBox:_searchFieldBeginEditing", "textBox:_searchFieldEditingChanged",
            "textBox:textChange", "textBox:textChanged", "textBox:textFieldDidChange", "toggleButton:click"
        ]

        // Keys the bridge consumes somewhere other than this method: load()
        // (the enable parameters and verbose native logging), the push
        // resolver, or the install-time podspec / gradle scripts. Enumerated
        // so the unrecognised-key warning below fires only on keys that
        // nothing consumes. A key falling through this method silently is what
        // kept the layout-config mismatch below hidden for so long.
        let handledElsewhere: Set<String> = [
            "AppKey", "PostMessageUrl",                             // load() -> enable(with:)
            "useRelease",                                           // load() -> verbose native logging
            "PushEnabled", "iOSPushMode", "iOSAppGroupIdentifier",  // ConnectRNParsing.resolvePushConfig
            "iOSDevelopmentTeam",                                   // install-time signing (podspec / Expo plugin)
            "iOSVersion", "AndroidVersion",                         // install-time (podspec / gradle)
            "AndroidNotificationIconResName",                       // Android-only
            "layoutConfigAndroid",                                  // Android-only
        ]

        for (key, value) in connectData {
            // Skip keys load() passes directly to enable — re-applying is harmless but redundant.
            if key == "AppKey" || key == "PostMessageUrl" { continue }

            if tealeafKeys.contains(key) || eocoreKeys.contains(key) {
                ConnectConfigStore.set(key, value: value)
            } else if !handledElsewhere.contains(key),
                      !ConnectRNParsing.layoutConfigKeys.contains(key) {
                configLog.warning("Connect.\(key, privacy: .public) in ConnectConfig.json is not a key this SDK applies — check it against the documented keys. Unrecognised keys are ignored.")
            }
        }

        // Resolved outside the loop: two keys feed this block (the shared
        // `layoutConfig` plus the platform-suffixed `layoutConfigIos`, which
        // is what the shipped ConnectConfig.json template writes and what the
        // podspec copies into the bundle verbatim), and their contents map onto
        // differently-named store keys — so it is not a per-key passthrough
        // like the lists above. Matching only the unsuffixed `layoutConfig`
        // here meant the entire iOS layout block was silently dropped, leaving
        // per-screen settings such as ScreenShot unconfigurable from
        // ConnectConfig.json. See ConnectRNParsing.resolveLayoutOverrides.
        for (storeKey, storeValue) in ConnectRNParsing.resolveLayoutOverrides(from: connectData) {
            ConnectConfigStore.set(storeKey, value: storeValue)
        }
    }

    // MARK: - Gate-keeper API

    /// Re-enables the Connect SDK after a prior `disable()`. All configuration
    /// comes from `ConnectConfig.json` — re-runs `load()` on the main actor,
    /// which the native SDK no-ops if it's already enabled.
    func enable() throws -> Bool {
        bridgeLog.info("enable() called from JS.")
        Task { @MainActor [weak self] in self?.load() }
        return true
    }

    /// Disables the Connect SDK. Idempotent — the native SDK handles repeat
    /// calls safely. After this call, sessions and push state are released;
    /// a subsequent `enable()` re-initialises from `ConnectConfig.json`.
    func disable() throws -> Bool {
        bridgeLog.info("disable() called from JS.")
        Task { @MainActor in
            ConnectSDK.shared.disable()
            bridgeLog.info("SDK disabled.")
        }
        return true
    }

    // MARK: - Push: APNs lifecycle

    /// Forwards the raw APNs device token to the SDK. Nitro hands us native
    /// `Data` via `ArrayBuffer` — no hex conversion, no validation. Idempotent
    /// in automatic mode (the SDK already captured the token via its swizzle).
    ///
    /// Resolves `true` once the SDK accepted the token, `false` if the call was
    /// rejected (e.g. push not enabled). Never rejects.
    func pushDidRegisterWithToken(deviceToken: ArrayBuffer) throws -> Promise<Bool> {
        let token = deviceToken.toData(copyIfNeeded: true)
        return Promise.async { @MainActor in
            do {
                try ConnectSDK.shared.push.didRegisterWithToken(token)
                return true
            } catch {
                bridgeLog.error("pushDidRegisterWithToken failed: \(error.localizedDescription, privacy: .public)")
                return false
            }
        }
    }

    /// Forwards an APNs registration failure to the SDK as an `NSError`.
    /// Resolves `true` once forwarded, `false` on failure. Never rejects.
    func pushDidFailToRegister(error: PushErrorInfo) throws -> Promise<Bool> {
        let nsError = Self.nsError(from: error)
        return Promise.async { @MainActor in
            do {
                try ConnectSDK.shared.push.didFailToRegisterWithError(nsError)
                return true
            } catch {
                bridgeLog.error("pushDidFailToRegister failed: \(error.localizedDescription, privacy: .public)")
                return false
            }
        }
    }

    // MARK: - Push: notification delivery — manual mode only

    /// Forwards a received notification so the SDK logs `pushReceived` (manual
    /// mode). Resolves `true` when processed. In automatic/off mode the SDK
    /// throws `pushModeNotManual` (its own delegate already handles delivery);
    /// the bridge catches it and resolves `false` — the `EAC-RN-007` surface.
    /// Never rejects.
    func pushDidReceiveNotification(userInfo: [String: Variant_Bool_String_Double]) throws -> Promise<Bool> {
        let notification = HybridAcousticConnectNotification(userInfo: convertToAnyDictionary(input: userInfo))
        return Promise.async { @MainActor in
            do {
                try ConnectSDK.shared.push.didReceiveNotification(notification)
                return true
            } catch {
                bridgeLog.error("pushDidReceiveNotification failed: \(error.localizedDescription, privacy: .public)")
                return false
            }
        }
    }

    /// Forwards a notification response (tap / action) so the SDK runs the
    /// built-in action and logs `pushAction` (manual mode). Resolves `true` when
    /// processed; `false` (EAC-RN-007) in automatic/off mode via the same
    /// caught `pushModeNotManual`. Never rejects.
    func pushDidReceiveResponse(actionIdentifier: String, userInfo: [String: Variant_Bool_String_Double]) throws -> Promise<Bool> {
        let response = HybridAcousticConnectNotificationResponse(
            actionIdentifier: actionIdentifier,
            userInfo: convertToAnyDictionary(input: userInfo)
        )
        return Promise.async { @MainActor in
            do {
                try ConnectSDK.shared.push.didReceive(response)
                return true
            } catch {
                bridgeLog.error("pushDidReceiveResponse failed: \(error.localizedDescription, privacy: .public)")
                return false
            }
        }
    }

    // MARK: - Push: permission management

    /// Forwards externally-obtained permission state to the SDK. Tri-state
    /// `granted`: `true`/`false` forward; `nil` (notDetermined) is recorded by
    /// the OS, not forwarded — the SDK has no notion of an "unknown" state.
    func pushDidReceiveAuthorization(granted: Variant_NullType_Bool?, error: PushErrorInfo?) throws -> Promise<Bool> {
        // `nil` (notDetermined) is intentionally not forwarded — the SDK has no
        // notion of an "unknown" authorization. This resolves `true` ("handled —
        // accepted, not forwarded"), not a failure.
        guard let triState = granted?.asType(Bool.self) else {
            return Promise.resolved(withResult: true)
        }
        // Not gated on push mode: the SDK's didReceiveAuthorization is safe in
        // both modes, so externally-obtained permission state is always forwarded.
        let nsError = error.map(Self.nsError(from:))
        return Promise.async { @MainActor in
            do {
                try ConnectSDK.shared.push.didReceiveAuthorization(granted: triState, error: nsError)
                return true
            } catch {
                bridgeLog.error("pushDidReceiveAuthorization failed: \(error.localizedDescription, privacy: .public)")
                return false
            }
        }
    }

    /// Requests notification permission via the SDK, presenting the system
    /// prompt when the status is undetermined, and resolves with the structured
    /// result. Never rejects — a system error (or push-not-enabled) surfaces in
    /// `error` with `granted: false`.
    func pushRequestPermission() throws -> Promise<PushPermissionResult> {
        return Promise.async { @MainActor in
            do {
                let result = try await ConnectSDK.shared.push.requestAuthorization()
                let error: Variant_NullType_String? = result.error.map { .second($0.localizedDescription) }
                return PushPermissionResult(granted: result.granted, error: error)
            } catch {
                bridgeLog.error("pushRequestPermission failed: \(error.localizedDescription, privacy: .public)")
                return PushPermissionResult(granted: false, error: .second(error.localizedDescription))
            }
        }
    }

    /// Reads the current notification permission state without prompting, mapped
    /// to a tri-state: `true` granted, `false` denied, `null` not determined.
    /// Never rejects — push-not-enabled resolves as `null`.
    func pushGetPermissionState() throws -> Promise<Variant_NullType_Bool> {
        return Promise.async { @MainActor in
            do {
                if let granted = try await ConnectSDK.shared.push.getCurrentAuthorization() {
                    return .second(granted)
                }
                return .first(.null)
            } catch {
                bridgeLog.error("pushGetPermissionState failed: \(error.localizedDescription, privacy: .public)")
                return .first(.null)
            }
        }
    }

    // MARK: - Push: helpers

    /// Builds an `NSError` from the structured bridge error object, shared by
    /// `pushDidFailToRegister` and `pushDidReceiveAuthorization`. Kept here
    /// (not in ConnectRNParsing) because `PushErrorInfo` is a C++-backed
    /// nitro type and ConnectRNParsing is also compiled into the UnitTests
    /// bundle, which builds without C++ interop.
    private static func nsError(from info: PushErrorInfo) -> NSError {
        NSError(
            domain: info.domain ?? "ConnectRNBridge",
            code: Int(info.code ?? -1),
            userInfo: [NSLocalizedDescriptionKey: info.message]
        )
    }

    /// Sets the module's configuration item from AdvancedConfig.json or BasicConfig.plist that matches the specified key as a BOOL value.
    /// - Parameters:
    ///   - key: Key to update value in configuration settings.
    ///   - value: Value to use.
    ///   - moduleName: The name of the module to be updated. For EOCore settings, please use 'EOCore' which can be found the following files EOCoreBasicConfig.plist, EOCoreBasicConfig.properties or EOCoreAdvancedConfig.json and 'Connect' for Connect which can be found the following files ConnectBasicConfig.plist, ConnectBasicConfig.properties or ConnectAdvancedConfig.json.
    /// - Returns: Whether it was able to set the value as Boolean value.
    func setBooleanConfigItemForKey(key: String, value: Bool, moduleName: String) throws -> Bool {
        return ConnectConfigStore.set(key, value: value)
    }
    
    /// Sets the module's configuration item from AdvancedConfig.json or BasicConfig.plist that matches the specified key as a NString value.
    /// - Parameters:
    ///   - key: Key to update value in configuration settings.
    ///   - value: Value to use.
    ///   - moduleName: The name of the module to be updated. For EOCore settings, please use 'EOCore' which can be found the following files EOCoreBasicConfig.plist, EOCoreBasicConfig.properties or EOCoreAdvancedConfig.json and 'Connect' for Connect which can be found the following files ConnectBasicConfig.plist, ConnectBasicConfig.properties or ConnectAdvancedConfig.json.
    /// - Returns: Whether it was able to set the value as Boolean value.
    func setStringItemForKey(key: String, value: String, moduleName: String) throws -> Bool {
        return ConnectConfigStore.set(key, value: value)
    }
    
    /// Sets the module's configuration item from AdvancedConfig.json or BasicConfig.plist that matches the specified key as a NSNumber value.
    /// - Parameters:
    ///   - key: Key to update value in configuration settings.
    ///   - value: Value to use.
    ///   - moduleName: The name of the module to be updated. For EOCore settings, please use 'EOCore' which can be found the following files EOCoreBasicConfig.plist, EOCoreBasicConfig.properties or EOCoreAdvancedConfig.json and 'Connect' for Connect which can be found the following files ConnectBasicConfig.plist, ConnectBasicConfig.properties or ConnectAdvancedConfig.json.
    /// - Returns: Whether it was able to set the value as Boolean value.
    func setNumberItemForKey(key: String, value: Double, moduleName: String) throws -> Bool {
        return ConnectConfigStore.set(key, value: value)
    }
  
  
    /// Sets the module's configuration item from AdvancedConfig.json or BasicConfig.properties that matches the specified key.
    /// - Parameters:
    ///   - key: Key to update value in configuration settings.
    ///   - value: Value to use.
    ///   - moduleName: The name of the module to be updated. For EOCore settings, please use 'EOCore' which can be found the following files EOCoreBasicConfig.plist, EOCoreBasicConfig.properties or EOCoreAdvancedConfig.json and 'Connect' for Connect which can be found the following files ConnectBasicConfig.plist, ConnectBasicConfig.properties or ConnectAdvancedConfig.json.
    /// - Returns: Whether it was able to set the value.
    func setConfigItemForKey(key: String, value: Variant_Bool_String_Double, moduleName: String) throws -> Bool {
        return ConnectConfigStore.set(key, value: convertVariantToAny(value))
    }
    
    /// Gets the module's configuration item from AdvancedConfig.json or BasicConfig.plist that matches the specified key as a BOOL value.
    /// - Parameters:
    ///   - key: Key to update value in configuration settings.
    ///   - theDefault: Default value if not found.
    ///   - moduleName: The name of the module to be updated. For EOCore settings, please use 'EOCore' which can be found the following files EOCoreBasicConfig.plist, EOCoreBasicConfig.properties or EOCoreAdvancedConfig.json and 'Connect' for Connect which can be found the following files ConnectBasicConfig.plist, ConnectBasicConfig.properties or ConnectAdvancedConfig.json.
    /// - Returns: The value of the configuration item key as a BOOL value.
    func getBooleanConfigItemForKey(theDefault: Bool, key: String, moduleName: String) throws -> Bool {
        return ConnectConfigStore.bool(forKey: key, default: theDefault)
    }
    
    /// Gets the module's configuration item from AdvancedConfig.json or BasicConfig.plist that matches the specified key as a NString value.
    /// - Parameters:
    ///   - key: Key to update value in configuration settings.
    ///   - theDefault: Default value if not found.
    ///   - moduleName: The name of the module to be updated. For EOCore settings, please use 'EOCore' which can be found the following files EOCoreBasicConfig.plist, EOCoreBasicConfig.properties or EOCoreAdvancedConfig.json and 'Connect' for Connect which can be found the following files ConnectBasicConfig.plist, ConnectBasicConfig.properties or ConnectAdvancedConfig.json.
    /// - Returns: The value of the configuration item key as a NString value.
    func getStringItemForKey(theDefault: String, key: String, moduleName: String) throws -> Variant_NullType_String? {
        let result = ConnectConfigStore.string(forKey: key, default: theDefault)
        return result.map { .second($0) }
    }
    
    /// Gets the module's configuration item from AdvancedConfig.json or BasicConfig.plist that matches the specified key as a NSNumber value.
    /// - Parameters:
    ///   - key: Key to update value in configuration settings.
    ///   - theDefault: Default value if not found.
    ///   - moduleName: The name of the module to be updated. For EOCore settings, please use 'EOCore' which can be found the following files EOCoreBasicConfig.plist, EOCoreBasicConfig.properties or EOCoreAdvancedConfig.json and 'Connect' for Connect which can be found the following files ConnectBasicConfig.plist, ConnectBasicConfig.properties or ConnectAdvancedConfig.json.
    /// - Returns: The value of the configuration item key as a NSNumber value.
    func getNumberItemForKey(theDefault: Double, key: String, moduleName: String) throws -> Double {
        return ConnectConfigStore.number(forKey: key, default: theDefault)
    }
    
    /// Log custom event.
    /// - Parameters:
    ///   - eventName:the name of the event to be logged this will appear in the posted json.
    ///   - values: additional key value pairs to be logged with the message.
    ///   - level: set a custom log level to the event.
    /// - Returns: Boolean value will return whether it was able to log the custom event.
    func logCustomEvent(eventName: String, values: Dictionary<String, Variant_Bool_String_Double>, level: Double) throws -> Bool {
        let logLevel = try getLogLevel(level: level)
        let result = ConnectCustomEvent().logEvent(eventName, values: convertToAnyDictionary(input: values), level: logLevel)
        return Self.warnIfRejected(result, api: "logCustomEvent", detail: eventName)
    }

    /// Surfaces a `false` returned by a native logging call, and passes it
    /// through unchanged.
    ///
    /// The bridge's boolean means "the SDK accepted this for delivery", never
    /// "the collector received it" — nothing on the device knows the latter.
    /// But the *accepted* half was itself invisible: a `false` reached JS as a
    /// bare return value that the wrapper's callers almost never inspect, with
    /// nothing in `os_log`. Callers reporting "the event never arrived" had no
    /// way to tell a rejected call from a delivery problem. One line at
    /// `.warning` distinguishes them.
    ///
    /// Deliberately does not change the return value or throw: an analytics
    /// bridge must not turn a rejected event into an app-visible failure.
    ///
    /// - Parameters:
    ///   - result: The value the native call returned.
    ///   - api: Name of the bridge method, for the log line.
    ///   - detail: Optional extra identifier, e.g. an event name.
    /// - Returns: `result`, unchanged.
    @discardableResult
    private static func warnIfRejected(_ result: Bool, api: String, detail: String? = nil) -> Bool {
        if !result {
            let suffix = detail.map { " (\($0))" } ?? ""
            bridgeLog.warning("\(api, privacy: .public)\(suffix, privacy: .public): the Connect SDK did not accept the event; nothing was queued for delivery. Check that the SDK is enabled and the payload is valid.")
        }
        return result
    }
    
    /// Log signal data.
    ///
    /// Takes an `AnyMap` rather than a map of scalars so JS callers can send
    /// arbitrary JSON — nested objects and arrays included. `CTSignalMessage`
    /// embeds the dictionary verbatim and gates only on
    /// `NSJSONSerialization.isValidJSONObject:`, so nesting needs no special
    /// handling beyond producing a JSON-representable dictionary:
    /// `AnyMap.toDictionary()` yields `[String: Any?]` (nested containers
    /// carry optionals too), which `jsonSafeDictionary` normalises by
    /// unwrapping the optionals and mapping `null` to `NSNull`. Nothing is
    /// flattened or reshaped.
    /// - Parameters:
    ///   - values: signal payload; objects, arrays and scalars are all carried through.
    ///   - level: set a custom log level to the event.
    /// - Returns: Boolean value will return whether it was able to log the signal message.
    func logSignal(values: AnyMap, level: Double) throws -> Bool {
        let logLevel = try getLogLevel(level: level)
        let payload = ConnectRNParsing.jsonSafeDictionary(values.toDictionary())
        let result = ConnectCustomEvent().logSignal(payload, level: logLevel)
        return Self.warnIfRejected(result, api: "logSignal")
    }

    /// Logs a user identity so device activity can be associated with a known
    /// Connect contact. Wraps `ConnectSDK.shared.identity.log(...)`.
    ///
    /// `ConnectSDK.shared` is `@MainActor`-isolated, so — unlike the synchronous
    /// loggers above (which use the legacy non-actor `ConnectCustomEvent`) —
    /// this hops to the main actor and resolves with the SDK's real return
    /// value. The native API returns `false` (and emits no signal) when either
    /// identifier is blank, satisfying the bridge's blank-input contract without
    /// extra guards here. `url`, if supplied, rides inside `additionalParameters`
    /// (the iOS convention).
    /// - Parameters:
    ///   - identifierName: Identifier name, e.g. "Email".
    ///   - identifierValue: Identifier value, e.g. "user@example.com".
    ///   - signalType: Optional signal type; defaults to "loggedIn" when omitted.
    ///   - additionalParameters: Optional extra key/value pairs merged into the
    ///     signal. Defaults, only when `nil` (omitted), to the method attribute
    ///     the resolved signal type requires — `["loginMethod": "email"]` for
    ///     `loggedIn`, `["registrationMethod": "email"]` otherwise (see
    ///     `ConnectRNParsing.defaultIdentityParameters(for:)`). An explicit map
    ///     — including an empty one — is used as-is.
    /// - Returns: A promise resolving to `true` if the signal was dispatched,
    ///   `false` otherwise. Never rejects.
    func logIdentity(identifierName: String, identifierValue: String, signalType: String?, additionalParameters: [String: String]?) throws -> Promise<Bool> {
        let resolvedSignalType = signalType ?? "loggedIn"
        let resolvedParameters = additionalParameters
            ?? ConnectRNParsing.defaultIdentityParameters(for: resolvedSignalType)
        return Promise.async { @MainActor in
            let result = ConnectSDK.shared.identity.log(
                identifierName: identifierName,
                identifierValue: identifierValue,
                signalType: resolvedSignalType,
                additionalParameters: resolvedParameters
            )
            // An identity signal the SDK accepts can still be rejected
            // downstream by schema validation — a mismatched method attribute
            // has cost a customer 22 signals while every call reported
            // success. The bridge cannot see that; it can at least report the
            // half it does see.
            return HybridAcousticConnectRN.warnIfRejected(result, api: "logIdentity", detail: resolvedSignalType)
        }
    }

    /// Log exception.
    /// - Parameters:
    ///   - message: the message of the error/exception to be logged this will appear in the posted json.
    ///   - stackInfo: the stack trace to be logged with the message.
    ///   - unhandled: Whether exception is unhandled.
    /// - Returns: Boolean value will return whether it was able to log the exception event.
    func logExceptionEvent(message: String, stackInfo: String, unhandled: Bool) throws -> Bool {
        let exceptionDict: [String: Any] = [
            "type": "React Plugin",
            "message": message,
            "stacktrace": stackInfo
        ]
        let result = ConnectCustomEvent().logNSExceptionEvent(nil, dataDictionary: exceptionDict, isUnhandled: unhandled)
        return result
    }
    
    /// Requests that the framework logs a geographic location
    /// - Returns: Boolean value will return whether it was able to log the location event.
    func logLocation() throws -> Bool {
        let result = ConnectCustomEvent().logLocation(nil)
        return result
    }
    
    /// Requests that the framework logs the location information. This is not logged automatically to avoid making unnecessary location updates and to protect the privacy of your application's users by ensuring that location is reported only when the app has some other reason to request it. Your application must include the Core Location framework.
    /// - Parameters:
    ///   - latitude: The geographic latitude of the user.
    ///   - longitude: The geographic longitude of the user.
    ///   - level: lThe monitoring level of the event.
    /// - Returns: Boolean value will return whether it was able to log the location event.
    func logLocationWithLatitudeLongitude(latitude: Double, longitude: Double, level: Double) throws -> Bool {
        let logLevel = try getLogLevel(level: level)
        let result = ConnectCustomEvent().logLocationUpdate(withLatitude: latitude, longitude: longitude, level: logLevel)
        return result
    }
    
    /// Requests that the framework logs the click events on any UIControl or UIView. Click event is a normalized form of touch up inside event.
    /// - Parameters:
    ///   - target: Native node handle for a component from React Native.
    ///   - controlId: Control id a component from React Native.
    /// - Returns: Boolean value will return whether it was able to log the click event.
    func logClickEvent(target: Double, controlId: String) throws -> Bool {
      var result: Bool = false
      Task { @MainActor in
        let view: UIView? = nil
        let result = ConnectCustomEvent().logClick(view, controlId: controlId, data: nil)
        _ = result
      }
      return result
    }
    
    /// Requests that the framework logs the text change events.
    /// - Parameters:
    ///   - target: Native node handle for a component from React Native.
    ///   - controlId: Control id a component from React Native.
    ///   - text: The input string from txt control.
    /// - Returns: Boolean value will return whether it was able to log the text change event.
    func logTextChangeEvent(target: Double, controlId: String, text: Variant_NullType_String?) throws -> Bool {
        let view:UIView? = nil
        var data: [String: Any] = [:]

        if case .second(let str) = text {
            data["text"] = str
        }
        let result = ConnectCustomEvent().logTextChange(view, controlId: controlId, data: data)
        return result
    }
    
    /// Requests that the framework save the current  application page name.
    /// - Parameter logicalPageName: Page name or title e.g. "Login View Controller"; Must not be empty.
    /// - Returns: Boolean value will return whether it was able to log the screenview event.
    func setCurrentScreenName(logicalPageName: String) throws -> Bool {
        let result = ConnectApplicationHelper().setCurrentScreenName(logicalPageName)
        return result
    }
    
    /// Requests that the framework logs an application context for load.
    /// - Parameters:
    ///   - logicalPageName: Page name or title e.g. "Login View Controller"; Must not be empty.
    ///   - referrer: Page name or title that loads logicalPageName. Could be empty.
    /// - Returns: Boolean value will return whether it was able to log the screenview event.
    func logScreenViewContextLoad(logicalPageName: Variant_NullType_String?, referrer: Variant_NullType_String?) throws -> Bool {
        let pageName: String? = { if case .second(let s) = logicalPageName { return s }; return nil }()
        let ref: String? = { if case .second(let s) = referrer { return s }; return nil }()
        let cllasss = pageName == nil ? "ReactNative" : "ReactNative_\(pageName!)"
        let result = ConnectCustomEvent().logScreenViewContext(pageName, withClass: cllasss, applicationContext: ConnectScreenViewType.load, referrer: ref)
        return result
    }
    
    /// Requests that the framework logs an application context for unload.
    /// - Parameters:
    ///   - logicalPageName: Page name or title e.g. "Login View Controller"; Must not be empty.
    ///   - referrer: Page name or title that loads logicalPageName. Could be empty.
    /// - Returns: Boolean value will return whether it was able to log the screenview event.
    func logScreenViewContextUnload(logicalPageName: Variant_NullType_String?, referrer: Variant_NullType_String?) throws -> Bool {
        let pageName: String? = { if case .second(let s) = logicalPageName { return s }; return nil }()
        let ref: String? = { if case .second(let s) = referrer { return s }; return nil }()
        let cllasss = pageName == nil ? "ReactNative" : "ReactNative_\(pageName!)"
        let result = ConnectCustomEvent().logScreenViewContext(pageName, withClass: cllasss, applicationContext: ConnectScreenViewType.unload, referrer: ref)
        return result
    }
    
    /// The view controller a layout capture should describe — the iOS analogue
    /// of the Android bridge's `getCurrentActivity()`.
    ///
    /// Mirrors the framework's own resolution (`TLFUILifeCycleAIC
    /// -getDefaultVC:`, which is also what the pre-Nitro Objective-C bridge
    /// did here): start at the foreground key window's root, walk the
    /// `presentedViewController` chain to whatever is actually on top — a React
    /// Native `<Modal>` presents its own host controller — and unwrap
    /// container controllers to the child that is really showing.
    ///
    /// Two deliberate departures from that precedent:
    ///
    /// - It enumerates `UIScene`s rather than asking EOCore for the window.
    ///   This bridge links `Connect` only, so `EOApplicationHelper` is not
    ///   reachable, and scene enumeration is also the correct answer on a
    ///   multi-window iPad where several scenes each hold a key window.
    /// - It unwraps `UITabBarController` as well as `UINavigationController`.
    ///   The framework only unwraps navigation controllers; capturing a tab
    ///   controller is not wrong (its view contains the selected child), but
    ///   the selected child is the screen the capture is named after.
    ///
    /// Must be called on the main thread — see `captureScreenLayout`.
    private static func resolveTopViewController() -> UIViewController? {
        let windowScenes = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
        // Prefer the scene the user is actually looking at, but do not stop
        // there: a foreground scene can exist with no window yet, while a
        // merely-inactive one still holds the window that is on screen. So
        // order the scenes by preference and take the first that yields a
        // window, rather than committing to one scene up front.
        let orderedScenes =
            windowScenes.filter { $0.activationState == .foregroundActive }
            + windowScenes.filter { $0.activationState != .foregroundActive }
        // `keyWindow` is nil for a scene whose windows are all non-key (a
        // freshly attached scene, a scene hosting only an overlay), hence the
        // `windows.first` fallback.
        guard let window = orderedScenes.compactMap({ $0.keyWindow ?? $0.windows.first }).first else {
            return nil
        }

        var top = window.rootViewController
        // Bounded rather than an open `while`. In practice the chain is a short
        // linked list, but this runs on every navigation, so a pathological
        // cycle must not hang the main thread.
        var hops = 0
        while hops < 32 {
            hops += 1
            // Presentation first: `presentedViewController` also reports a
            // modal put up by a descendant, so checking it before unwrapping a
            // container lands on the modal directly instead of on the
            // container's child underneath it.
            if let presented = top?.presentedViewController {
                top = presented
                continue
            }
            if let nav = top as? UINavigationController,
               let visible = nav.topViewController {
                top = visible
                continue
            }
            if let tabs = top as? UITabBarController,
               let selected = tabs.selectedViewController {
                top = selected
                continue
            }
            break
        }
        return top
    }

    /// Resolves the top view controller and hands it to the framework, as one
    /// unit. **Must run on the main thread** — both halves need it:
    ///
    /// - `resolveTopViewController` touches UIApplication / UIWindowScene /
    ///   UIViewController.
    /// - The framework's own overloads split on the delay.
    ///   `logScreenLayoutWithViewController:andDelay:andName:` wraps its work in
    ///   a `dispatch_after` onto the main queue and returns `YES` immediately,
    ///   but `logScreenLayoutWithViewController:andName:` — the `delayMs <= 0`
    ///   path — runs the whole view-tree walk synchronously on the *caller's*
    ///   thread. Calling that from the JS thread would traverse UIKit off-main.
    ///
    /// Returns whether the framework accepted the capture; `false` also covers
    /// "no view controller resolved", which is logged here because the caller
    /// may no longer be in a position to report it (see `logScreenLayout`).
    @discardableResult
    private static func captureScreenLayout(name: String, delayMs: Double) -> Bool {
        guard let uvc = resolveTopViewController() else {
            bridgeLog.error("logScreenLayout(\(name, privacy: .public)): no view controller resolved; skipping capture.")
            return false
        }
        if delayMs <= 0 {
            return ConnectCustomEvent().logScreenLayout(with: uvc, andName: name)
        }
        return ConnectCustomEvent().logScreenLayout(with: uvc, andDelay: delayMs / 1000.0, andName: name)
    }

    /// Requests that the framework logs the layout of the screen.
    ///
    /// - Parameters:
    ///   - name: Custom name to associate with the viewcontroller.
    ///   - delay: Milliseconds to wait before capturing. A negative value means
    ///     "use the `CaptureLayoutDelay` configured for this screen", which is
    ///     what the JS wrapper sends when the caller names no delay.
    /// - Returns: Boolean value will return whether it was able to log the screen layout event.
    ///
    /// Two things worth knowing before editing this:
    ///
    /// - `delay` crosses the bridge in **milliseconds**, matching both
    ///   `CaptureLayoutDelay` and the Android bridge, but the native
    ///   `andDelay:` API takes **seconds** (`delay * NSEC_PER_SEC`). The
    ///   conversion below is the whole reason a raw passthrough was wrong: a
    ///   caller asking for a 300 ms deferral used to get 300 *seconds*.
    /// - The no-delay overload captures synchronously, on the calling thread,
    ///   with no reference to the configured delay at all. Sending 0 for every
    ///   screen — which the wrapper used to do — therefore fired the capture
    ///   mid-transition and made `CaptureLayoutDelay` inert on iOS.
    ///
    /// The view controller used to be a hardcoded nil, and a nil controller is
    /// not benign: the framework's layout processor guards on a non-nil
    /// controller and reports failure without queueing anything, so every
    /// JS-triggered capture on iOS produced no layout message at all — while
    /// the deferred overload still returned true the moment it scheduled, so
    /// the bridge reported success for a capture that never happened.
    func logScreenLayout(name: String, delay: Double) throws -> Bool {
        // Config reads only — safe on any thread, and cheap enough to do before
        // the hop so the closure below captures plain values.
        let configuredLayout = consumerSuppliedAutoLayout
            ? ConnectConfigStore.dictionary(forKey: ConnectRNParsing.autoLayoutConfigKey)
            : nil
        let delayMs = delay < 0
            ? ConnectRNParsing.captureLayoutDelayMs(for: name, in: configuredLayout)
            : delay

        // Already on main: run inline and report what the framework actually
        // said. This is the only path that can return a truthful failure.
        if Thread.isMainThread {
            return Self.captureScreenLayout(name: name, delayMs: delayMs)
        }

        // Off main — in practice the JS thread. Dispatch **async**, never
        // `sync`: the main thread can itself synchronously wait on the JS
        // thread (an established React Native / Fabric pattern, the
        // `RCTUnsafeExecuteOnMainQueueSync` family), so a blocking hop from
        // here inverts the lock order and can deadlock the app on an ordinary
        // navigation. Async costs the return value — resolution and the
        // framework call both happen after this method has returned — so a
        // failure surfaces in the log inside `captureScreenLayout` rather than
        // in the result, and `true` here means "capture scheduled", exactly the
        // semantics the framework's own delayed overload already has.
        // Named explicitly rather than through `Self` so this escaping closure
        // captures nothing but the two value parameters — no reference to the
        // HybridObject outlives the call.
        DispatchQueue.main.async {
            HybridAcousticConnectRN.captureScreenLayout(name: name, delayMs: delayMs)
        }
        return true
    }
    
    /// Logs a dialog show event with the specified dialog information.
    /// - Parameters:
    ///   - dialogId: Unique identifier for the dialog.
    ///   - dialogTitle: The title of the dialog.
    ///   - dialogType: The type of dialog (alert, custom, modal).
    /// - Returns: Boolean value will return whether it was able to log the dialog show event.
    func logDialogShowEvent(dialogId: String, dialogTitle: String, dialogType: String) throws -> Bool {
        let values: [String: Any] = [
            "dialogId": dialogId,
            "dialogTitle": dialogTitle,
            "dialogType": dialogType,
            "eventType": "dialog_show",
            "timestamp": String(Int(Date().timeIntervalSince1970 * 1000))
        ]
        
        return true
    }
    
    /// Logs a dialog dismiss event with the specified dialog information.
    /// - Parameters:
    ///   - dialogId: Unique identifier for the dialog.
    ///   - dismissReason: The reason for dismissing the dialog.
    /// - Returns: Boolean value will return whether it was able to log the dialog dismiss event.
    func logDialogDismissEvent(dialogId: String, dismissReason: String) throws -> Bool {
        let values: [String: Any] = [
            "dialogId": dialogId,
            "dismissReason": dismissReason,
            "eventType": "dialog_dismiss",
            "timestamp": String(Int(Date().timeIntervalSince1970 * 1000))
        ]
        
        return true
    }
    
    /// Logs a dialog button click event with the specified button information.
    /// - Parameters:
    ///   - dialogId: Unique identifier for the dialog.
    ///   - buttonText: The text of the clicked button.
    ///   - buttonIndex: The index of the clicked button.
    /// - Returns: Boolean value will return whether it was able to log the dialog button click event.
    func logDialogButtonClickEvent(dialogId: String, buttonText: String, buttonIndex: Double) throws -> Bool {
        let values: [String: Any] = [
            "dialogId": dialogId,
            "buttonText": buttonText,
            "buttonIndex": String(Int(buttonIndex)),
            "eventType": "dialog_button_click",
            "timestamp": String(Int(Date().timeIntervalSince1970 * 1000))
        ]
        
        return true
    }
    
    /// Logs a custom dialog event with the specified event information.
    /// - Parameters:
    ///   - dialogId: Unique identifier for the dialog.
    ///   - eventName: The name of the custom event.
    ///   - values: A map of values associated with the event.
    /// - Returns: Boolean value will return whether it was able to log the dialog custom event.
    func logDialogCustomEvent(dialogId: String, eventName: String, values: Dictionary<String, Variant_Bool_String_Double>) throws -> Bool {
        var eventValues: [String: Any] = [
            "dialogId": dialogId,
            "customEventName": eventName,
            "eventType": "dialog_custom_event",
            "timestamp": String(Int(Date().timeIntervalSince1970 * 1000))
        ]
        
        // Add the custom values
        let convertedValues = convertToAnyDictionary(input: values)
        for (key, value) in convertedValues {
            eventValues[key] = value
        }
        
        return true
    }
    
    // The bodies below moved to ConnectRNParsing (behaviour-preserving
    // extraction); these thin delegates keep the class API stable.
    func testModuleName(moduleName: String) throws -> String {
        return ConnectRNParsing.storeModuleName(for: moduleName)
    }

    func convertToAnyDictionary(input: [String: Variant_Bool_String_Double]) -> [String: Any] {
        return ConnectRNParsing.convertToAnyDictionary(input: input)
    }

    func convertVariantToAny(_ variant: Variant_Bool_String_Double) -> Any {
        return ConnectRNParsing.convertVariantToAny(variant)
    }
    
//    func convertKeyValueMapToDictionary(_ keyValueMap: KeyValueMap) -> [AnyHashable: Any] {
//        var dictionary: [AnyHashable: Any] = [:]
//        // Assuming KeyValueMap provides a method to access keys and values
//        for key in keyValueMap.keys {
//            if let value = keyValueMap[key] {
//                dictionary[key] = value
//            }
//        }
//        return dictionary
//    }
    
    func getLogLevelHelper(level: Double) throws -> kConnectMonitoringLevelType {
        return ConnectRNParsing.logLevel(from: level)
    }
    
    func getLogLevel(level: Double) throws -> kConnectMonitoringLevelType {
        do {
            // Try to get the log level
            return try getLogLevelHelper(level: level)
        } catch {
            // Return a default value if an error occurs
            return kConnectMonitoringLevelType.connectMonitoringLevelIgnore
        }
    }
    
    deinit {
        // Perform any necessary cleanup here
        print("HybridAcousticConnectRN deinitialized")
    }
}
