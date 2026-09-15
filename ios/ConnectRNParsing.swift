// Copyright (C) 2026 Acoustic, L.P. All rights reserved.
//
// NOTICE: This file contains material that is confidential and proprietary to
// Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
// industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
// Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
// prohibited.

import Foundation
import Connect
import OSLog

// Same subsystem/category as the bridge's config logger so the extraction
// does not change where these lines surface in Console.app.
private let configLog = Logger(subsystem: "com.acoustic.AcousticConnectRN", category: "config")

/// Pure parsing / mapping / conversion logic extracted from
/// `HybridAcousticConnectRN` (behaviour-preserving extraction) so it can be
/// unit-tested without constructing the hybrid — the hybrid's `init`
/// dispatches `load()`, which enables the real SDK with the bundled AppKey.
internal enum ConnectRNParsing {

    internal enum IOSPushMode: Equatable {
        case automatic, manual
        var descriptor: String { self == .automatic ? "automatic" : "manual" }
    }

    /// Lenient `PushEnabled` parser — accepts a `Bool` directly, or a string
    /// like `"true"`/`"false"`/`"yes"`/`"no"`. Anything else falls back to
    /// `false` with a warning so a typo in the JSON doesn't silently enable
    /// push when the developer thought they'd turned it off.
    static func parsePushEnabled(_ raw: Any?) -> Bool {
        if let b = raw as? Bool { return b }
        if let n = raw as? NSNumber { return n.boolValue }
        if let s = raw as? String {
            switch s.lowercased() {
            case "true", "yes", "1": return true
            case "false", "no", "0", "": return false
            default:
                configLog.warning("PushEnabled string \"\(s, privacy: .public)\" not recognised. Falling back to false.")
                return false
            }
        }
        if raw != nil {
            configLog.warning("PushEnabled is set but is neither a Bool nor a recognised string. Falling back to false.")
        }
        return false
    }

    static func parseIOSPushMode(_ raw: String?) -> IOSPushMode {
        switch raw?.lowercased() {
        case "automatic", "auto", nil, "":
            return .automatic
        case "manual":
            return .manual
        default:
            configLog.error("iOSPushMode \"\(raw ?? "", privacy: .public)\" not recognised. Allowed values: \"automatic\", \"manual\". Falling back to \"automatic\".")
            return .automatic
        }
    }

    /// Resolves `PushEnabled` + `iOSPushMode` + `iOSAppGroupIdentifier` from the
    /// bundled config into a `ConnectPushConfig`. Validation errors are logged
    /// at `.error`; soft mismatches at `.warning`. The SDK always falls back to
    /// a safe default (`.off`) so an invalid config never crashes the app.
    static func resolvePushConfig(from connectData: [String: Any]) -> ConnectPushConfig {
        let pushEnabled = parsePushEnabled(connectData["PushEnabled"])
        let iOSPushModeRaw = connectData["iOSPushMode"] as? String
        let groupId = connectData["iOSAppGroupIdentifier"] as? String

        configLog.info("PushEnabled: \(pushEnabled)")

        // Inconsistency: iOSPushMode is set but PushEnabled is false. The
        // mode value would never take effect; warn the developer so they
        // know to fix one or the other.
        if !pushEnabled, let raw = iOSPushModeRaw, !raw.isEmpty {
            configLog.error("iOSPushMode \"\(raw, privacy: .public)\" is set but PushEnabled is false. Ignoring iOSPushMode; SDK will run with push disabled.")
            return .off
        }

        guard pushEnabled else {
            configLog.info("iOSPushMode: (not used, PushEnabled is false)")
            configLog.info("iOSAppGroupIdentifier: (not used, PushEnabled is false)")
            return .off
        }

        let mode = parseIOSPushMode(iOSPushModeRaw)
        configLog.info("iOSPushMode: \(mode.descriptor, privacy: .public)")
        if let groupId = groupId, !groupId.isEmpty {
            configLog.info("iOSAppGroupIdentifier: \(groupId, privacy: .public)")
        } else {
            configLog.warning("iOSAppGroupIdentifier is not set. Required if your app uses a Notification Service or Notification Content extension to render rich push payloads.")
        }

        switch mode {
        case .automatic:
            return ConnectPushConfig(mode: .automatic, appGroupIdentifier: groupId)
        case .manual:
            return ConnectPushConfig(mode: .manual, appGroupIdentifier: groupId)
        }
    }

    // Note: nsError(from: PushErrorInfo) stays in HybridAcousticConnectRN —
    // PushErrorInfo is a C++-backed nitro type, and this file is also
    // compiled into the UnitTests bundle, which builds without C++ interop.

    /// `Connect` config keys that can carry an iOS layout-config block, in
    /// **base-to-override order**: the shared block is the base, and the
    /// iOS-specific block is layered on top of it.
    ///
    /// `layoutConfigIos` is what the shipped `ConnectConfig.json` template
    /// writes, and the podspec copies the consumer's file into the resource
    /// bundle verbatim (no key rename), so that is the key that actually
    /// arrives at runtime. `layoutConfig` is the shared, cross-platform block:
    /// a consumer can set a common baseline there and refine it per platform.
    ///
    /// `layoutConfigAndroid` is deliberately absent: applying it here would
    /// push Android screen rules onto the iOS SDK.
    static let layoutConfigKeys = ["layoutConfig", "layoutConfigIos"]

    /// Entries of the layout-config block that map onto config-store overrides.
    private static let layoutOverrideKeys = ["AutoLayout", "AppendMapIds"]

    /// Recursively merges `override` onto `base`.
    ///
    /// Nested objects merge key by key, so a shared baseline survives a
    /// platform block that only refines part of it. Every other value —
    /// including arrays such as `MaskIdList` — is replaced outright rather than
    /// concatenated, so a platform block can shorten a shared list.
    static func deepMerging(_ base: [String: Any], _ override: [String: Any]) -> [String: Any] {
        var merged = base
        for (key, overrideValue) in override {
            if let baseChild = merged[key] as? [String: Any],
               let overrideChild = overrideValue as? [String: Any] {
                merged[key] = deepMerging(baseChild, overrideChild)
            } else {
                merged[key] = overrideValue
            }
        }
        return merged
    }

    /// Resolves the iOS layout-config block into the config-store overrides to
    /// apply, keyed by the name the native SDK reads. `AutoLayout` becomes
    /// `kConfigurableItemAutoLayout`, which `TLFAutoInstrumentationManger`
    /// consumes for per-screen settings such as `ScreenShot` and
    /// `CaptureScreenshotOn`.
    ///
    /// Both keys in ``layoutConfigKeys`` contribute: the shared `layoutConfig`
    /// is applied first and `layoutConfigIos` is deep-merged over it, so an
    /// iOS-specific value wins key by key while the shared baseline is kept for
    /// everything the iOS block does not mention. A malformed block is logged
    /// and skipped rather than aborting the rest of the resolution.
    ///
    /// Returns an empty dictionary when nothing is applicable, in which case
    /// the caller applies nothing and the SDK keeps the defaults from its own
    /// bundled `ConnectLayoutConfig.json`.
    static func resolveLayoutOverrides(from connectData: [String: Any]) -> [String: Any] {
        var block: [String: Any] = [:]
        var contributing: [String] = []

        for name in layoutConfigKeys {
            guard let value = connectData[name] else { continue }
            guard let candidate = value as? [String: Any] else {
                configLog.error("Connect.\(name, privacy: .public) in ConnectConfig.json is not a JSON object. Ignoring it; iOS screen-capture settings fall back to the SDK defaults.")
                continue
            }
            block = deepMerging(block, candidate)
            contributing.append(name)
        }

        guard !contributing.isEmpty else { return [:] }

        var overrides: [String: Any] = [:]
        for name in layoutOverrideKeys {
            if let override = block[name] {
                overrides[name] = override
            }
        }

        let sources = contributing.joined(separator: " <- ")
        if overrides.isEmpty {
            configLog.warning("Connect.\(sources, privacy: .public) carries no recognised override (expected AutoLayout and/or AppendMapIds). iOS screen-capture settings fall back to the SDK defaults.")
        } else {
            let applied = overrides.keys.sorted().joined(separator: ", ")
            configLog.info("Applying layout overrides [\(applied, privacy: .public)] resolved from Connect.\(sources, privacy: .public)")
        }
        return overrides
    }

    // MARK: - Capture-layout delay

    /// Config-store key holding the resolved `AutoLayout` block. Spelled out
    /// rather than taken from Tealeaf's `kConfigurableItemAutoLayout` macro
    /// because the bridge deliberately links against `Connect` only — see the
    /// note on `ConnectConfigStore`. Same string either way.
    static let autoLayoutConfigKey = "AutoLayout"

    /// Key holding the per-screen capture delay inside an `AutoLayout` rule.
    /// The value is in **milliseconds** — the auto-instrumentation path
    /// dispatches with `NSEC_PER_MSEC`, and `TLFAutoLayoutConfig` names its
    /// property `delayInMS`.
    private static let captureLayoutDelayKey = "CaptureLayoutDelay"

    /// Rule names holding the settings that apply to every screen. The second
    /// is the legacy spelling; the native SDK reads whichever is present, so
    /// this does too.
    private static let globalScreenSettingsKeys = ["GlobalScreenSettings", "IBMGlobalScreenSettings"]

    /// Delay applied when nothing in the resolved `AutoLayout` block names one.
    /// Matches `TLFAutoInstrumentationManger`'s own fallback.
    static let defaultCaptureLayoutDelayMs: Double = 500

    /// Resolves the `CaptureLayoutDelay` (milliseconds) that applies to
    /// `name`, from the `AutoLayout` block the native SDK holds in its config
    /// store.
    ///
    /// Resolution mirrors `TLFAutoInstrumentationManger`: the global rule
    /// supplies the baseline, and a rule named after the screen overrides it.
    /// The JS wrapper looks the screen up by its React Navigation route name,
    /// which is the key `ConnectConfig.json`'s `layoutConfig`/`layoutConfigIos`
    /// blocks are written against.
    ///
    /// Returns ``defaultCaptureLayoutDelayMs`` when the block is missing,
    /// malformed, or names no delay — never a value that would make the caller
    /// silently skip the deferral it asked for.
    static func captureLayoutDelayMs(for name: String, in autoLayout: [String: Any]?) -> Double {
        guard let autoLayout else { return defaultCaptureLayoutDelayMs }

        if let screenDelay = delayValue(in: autoLayout[name]) {
            return screenDelay
        }
        for key in globalScreenSettingsKeys {
            if let globalDelay = delayValue(in: autoLayout[key]) {
                return globalDelay
            }
        }
        return defaultCaptureLayoutDelayMs
    }

    /// Pulls `CaptureLayoutDelay` out of one `AutoLayout` rule. `nil` means
    /// "this rule says nothing about the delay", which is what lets the caller
    /// fall through to the next source rather than treating a missing rule as
    /// an explicit zero.
    private static func delayValue(in rule: Any?) -> Double? {
        guard let rule = rule as? [String: Any] else { return nil }
        guard let raw = rule[captureLayoutDelayKey] else { return nil }
        if let number = raw as? NSNumber { return max(0, number.doubleValue) }
        if let text = raw as? String, let parsed = Double(text) { return max(0, parsed) }
        configLog.warning("\(captureLayoutDelayKey, privacy: .public) is set but is not a number. Ignoring it.")
        return nil
    }

    /// Whether `ConnectConfig.json` supplies an `AutoLayout` block at all.
    ///
    /// Equivalent to asking whether ``resolveLayoutOverrides(from:)`` would
    /// return an `AutoLayout` override — `deepMerging` only ever adds keys, so
    /// the merged block carries `AutoLayout` exactly when some contributing
    /// block does — but silent, and cheap enough to run at construction. The
    /// resolver logs which sources it applied; calling it twice would print
    /// that summary twice.
    static func suppliesAutoLayout(_ connectData: [String: Any]) -> Bool {
        return layoutConfigKeys.contains { name in
            (connectData[name] as? [String: Any])?[autoLayoutConfigKey] != nil
        }
    }

    /// Maps the JS-facing module name to the config store's module name
    /// ("Connect" → "TLFCoreModule").
    static func storeModuleName(for moduleName: String) -> String {
        if moduleName.caseInsensitiveCompare("Connect") == .orderedSame {
            return "TLFCoreModule"
        }
        return moduleName
    }

    static func convertToAnyDictionary(input: [String: Variant_Bool_String_Double]) -> [String: Any] {
        var result: [String: Any] = [:]

        for (key, value) in input {
            switch value {
            case .first(let boolValue):
                result[key] = boolValue
            case .second(let stringValue):
                result[key] = stringValue
            case .third(let doubleValue):
                result[key] = doubleValue
            }
        }

        return result
    }

    /// Normalises a dictionary produced by `AnyMap.toDictionary()` into one
    /// that `NSJSONSerialization.isValidJSONObject:` accepts, which is the
    /// only gate `CTSignalMessage` applies before embedding the payload.
    ///
    /// Two things need fixing up. `AnyMap` models JS `null` as a Swift `nil`,
    /// and a dictionary holding `Optional.none` is not JSON-representable —
    /// `NSNull` is. And the nesting is optional-typed all the way down
    /// (`[String: Any?]` / `[Any?]`), so the walk has to be recursive rather
    /// than a single top-level pass. Values that are already scalars pass
    /// through untouched, so a flat payload converts to exactly what the
    /// previous scalar-only bridge produced.
    ///
    /// Deliberately takes plain Swift collections rather than `AnyMap`: this
    /// file is compiled into the UnitTests bundle, which builds without C++
    /// interop and therefore cannot see nitro's `AnyMap`/`AnyValue` types.
    /// The `AnyMap` unwrapping stays in `HybridAcousticConnectRN`.
    ///
    /// - Parameter input: dictionary from `AnyMap.toDictionary()`.
    /// - Returns: the same structure with optionals resolved.
    static func jsonSafeDictionary(_ input: [String: Any?]) -> [String: Any] {
        var result = [String: Any](minimumCapacity: input.count)
        for (key, value) in input {
            result[key] = jsonSafeValue(value)
        }
        return result
    }

    /// Recursive helper for ``jsonSafeDictionary(_:)``. Maps `nil` to `NSNull`
    /// and rebuilds nested dictionaries/arrays; every other value — `String`,
    /// `Double`, `Int64`, `Bool` — is already JSON-representable and is
    /// returned as-is.
    ///
    /// - Parameter value: a value from an `AnyMap`-derived container.
    /// - Returns: a JSON-representable equivalent.
    static func jsonSafeValue(_ value: Any?) -> Any {
        guard let value else { return NSNull() }
        if let nested = value as? [String: Any?] {
            return jsonSafeDictionary(nested)
        }
        if let array = value as? [Any?] {
            return array.map { jsonSafeValue($0) }
        }
        return value
    }

    static func convertVariantToAny(_ variant: Variant_Bool_String_Double) -> Any {
        switch variant {
        case .first(let boolValue):
            return boolValue
        case .second(let stringValue):
            return stringValue
        case .third(let doubleValue):
            return doubleValue
        }
    }

    /// Default `additionalParameters` for an identity signal, matched to the
    /// signal type the bridge will actually send.
    ///
    /// Connect's signal schema requires a *method* attribute on identity
    /// signals, and the required key differs per type: `loggedIn` requires
    /// `loginMethod`, `accountRegistered` requires `registrationMethod`.
    /// Supplying the wrong one fails schema validation and the signal is
    /// discarded, while `identity.log` still reports success — so the caller
    /// sees nothing wrong. Before this mapping existed the bridge paired its
    /// `loggedIn` default with `registrationMethod`, which meant every
    /// defaulted identity call was silently dropped.
    ///
    /// Only consulted when the caller omits `additionalParameters` entirely;
    /// an explicitly-provided map is passed through untouched.
    static func defaultIdentityParameters(for signalType: String) -> [String: String] {
        switch signalType {
        case "loggedIn":
            return ["loginMethod": "email"]
        default:
            return ["registrationMethod": "email"]
        }
    }

    static func logLevel(from level: Double) -> kConnectMonitoringLevelType {
        let intValue: Int = Int(level)
        if intValue == 0 {
            return kConnectMonitoringLevelType.connectMonitoringLevelIgnore
        } else if intValue == 1 {
            return kConnectMonitoringLevelType.connectMonitoringLevelCellularAndWiFi
        } else {
            return kConnectMonitoringLevelType.connectMonitoringLevelWiFi
        }
    }
}
