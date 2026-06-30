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

import { type HybridObject } from 'react-native-nitro-modules'

// Define a named type for the anonymous object
export type KeyValueObject = {
    placeholder: string; // Add a placeholder property to avoid the "empty struct" error
    [key: string]: unknown;
};

export type ConnectMonitoringLevelType = 'Ignore' | 'CellularAndWiFi' | 'WiFi'

/**
 * Structured error describing an APNs / permission failure.
 *
 * Mirrors the `firebase-messaging` / `notifee` ecosystem convention so callers
 * can forward a native error object without string-encoding it. The native
 * bridge reconstructs an `NSError` (iOS) from these fields.
 */
export interface PushErrorInfo {
    /** Platform error code, when available (maps to `NSError.code`). */
    code?: number
    /** Platform error domain, when available (maps to `NSError.domain`). */
    domain?: string
    /** Human-readable failure description (maps to `NSLocalizedDescriptionKey`). */
    message: string
}

/**
 * Result of a permission request.
 *
 * The Promise from {@link AcousticConnectRN.pushRequestPermission} always
 * resolves with this shape and never rejects. `error` is `null` on success or
 * a denial with no system error; a non-null string carries the system error's
 * localized description, or `'permission-prompt-abandoned'` if the host was
 * destroyed mid-prompt.
 */
export interface PushPermissionResult {
    /** `true` if the user granted permission, `false` otherwise. */
    granted: boolean
    /** `null` on success/clean denial; otherwise a description of the error. */
    error?: string | null
}

export interface AcousticConnectRN extends HybridObject<{ ios: 'swift', android: 'kotlin' }> {
    /**
     * Re-enables the Connect SDK after a prior {@link disable} call.
     *
     * The SDK auto-initialises at module load time using the values from
     * `ConnectConfig.json` at the consumer's project root — so for most apps
     * there is no need to call `enable()` at all. The method exists as the
     * pair of {@link disable}: if a consent flow, A/B-test gate, or opt-out
     * toggle previously called `disable()`, calling `enable()` brings the
     * SDK back up using the same bundled configuration.
     *
     * @returns `true` when the call was accepted and dispatched to the native
     *   SDK. `false` only when the platform cannot satisfy a precondition
     *   (e.g. Android without an `Application` context yet).
     *
     * @remarks
     * **Single source of truth.** All configuration (AppKey, PostMessageUrl,
     * push, platform extras) lives in `ConnectConfig.json` at the consumer's
     * project root. The podspec (iOS) and `config.gradle` (Android) bake
     * those values into the bundled config that the native bridge reads at
     * init time. There is no runtime override path — by design, to eliminate
     * the inconsistency surface that runtime arguments would create against
     * the bundled config.
     *
     * **Idempotency.** Owned by the native SDK. iOS
     * `ConnectSDK.shared.enable(with:)` short-circuits via
     * `guard !isEnabled else { return }` in its internal `enableCore`; the
     * Android `Connect.init` / `Connect.enable` pair behaves the same way
     * once the SDK is running.
     *
     * **Threading.** Returns synchronously; the native SDK call is
     * fire-and-forget on the main thread / actor.
     *
     * @example User opt-in after a prior opt-out
     * ```ts
     * import AcousticConnectRN from 'react-native-acoustic-connect'
     *
     * function onUserOptIn() {
     *   AcousticConnectRN.enable()
     * }
     * ```
     */
    enable(): boolean

    /**
     * Disables the Connect SDK and stops all data capture.
     *
     * After this call the SDK flushes pending data to the backend, stops
     * listening for events, and releases push state. Call {@link enable}
     * to bring the SDK back up using the same bundled configuration.
     *
     * @returns `true` when the call was accepted and dispatched. Idempotent —
     *   calling `disable()` on an already-disabled SDK is safe.
     *
     * @example User opt-out flow
     * ```ts
     * import AcousticConnectRN from 'react-native-acoustic-connect'
     *
     * function onUserOptOut() {
     *   AcousticConnectRN.disable()
     * }
     * ```
     */
    disable(): boolean
    setBooleanConfigItemForKey(key: string, value: boolean, moduleName: string): boolean
    setStringItemForKey(key: string, value: string, moduleName: string): boolean
    setNumberItemForKey(key: string, value: number, moduleName: string): boolean
    setConfigItemForKey(key: string, value: string | number | boolean, moduleName: string): boolean
    getBooleanConfigItemForKey(theDefault: boolean, key: string, moduleName: string): boolean
    getStringItemForKey(theDefault: string, key: string, moduleName: string):  string | null | undefined
    getNumberItemForKey(theDefault: number, key: string, moduleName: string): number
    logCustomEvent(eventName: string, values: Record<string, string | number | boolean>, level: number): boolean
    logSignal(values: Record<string, string | number | boolean>, level: number): boolean
    logExceptionEvent(message: string, stackInfo: string, unhandled: boolean): boolean
    logLocation(): boolean
    logLocationWithLatitudeLongitude(latitude: number, longitude: number, level: number): boolean
    logClickEvent(target: number, controlId: string): boolean
    logTextChangeEvent(target: number, controlId: string, text: string | null | undefined): boolean
    setCurrentScreenName(logicalPageName: string): boolean
    logScreenViewContextLoad(logicalPageName: string | null | undefined, referrer:string | null | undefined): boolean
    logScreenViewContextUnload(logicalPageName: string | null | undefined, referrer:string | null | undefined): boolean
    logScreenLayout(name: string, delay: number): boolean
    // New dialog event handling methods
    logDialogShowEvent(dialogId: string, dialogTitle: string, dialogType: string): boolean
    logDialogDismissEvent(dialogId: string, dismissReason: string): boolean
    logDialogButtonClickEvent(dialogId: string, buttonText: string, buttonIndex: number): boolean
    logDialogCustomEvent(dialogId: string, eventName: string, values: Record<string, string | number | boolean>): boolean

    /**
     * Logs a user identity so the current device/session can be associated with
     * a known Connect contact — the foundation for audience building and
     * cross-channel engagement. Wraps the native identity loggers
     * (`ConnectSDK.shared.identity.log` on iOS, `Connect.logIdentificationEvent`
     * on Android).
     *
     * Unlike the synchronous analytics loggers above, this returns a `Promise`:
     * `ConnectSDK.shared` (iOS) is `@MainActor`-isolated, so the bridge hops to the
     * main actor and resolves with the *real* success/failure value rather than
     * firing and forgetting.
     *
     * The native APIs return `false` — and emit no signal — when either
     * `identifierName` or `identifierValue` is empty/blank after trimming.
     *
     * @param identifierName  Identifier name, e.g. `'Email'`.
     * @param identifierValue Identifier value, e.g. `'user@example.com'`.
     * @param signalType      Optional signal type; the bridge supplies
     *   `'loggedIn'` when omitted (identity logging typically marks a sign-in),
     *   overriding the native SDKs' own `'pageView'` default.
     * @param additionalParameters Optional extra key/value pairs merged into the
     *   signal payload. Only when omitted (`undefined`) does the bridge supply
     *   the default `{ registrationMethod: 'email' }`; an explicitly-provided
     *   map is used as-is, so passing an empty `{}` sends no extra parameters
     *   (the default is not merged in). A `'url'` entry is honoured uniformly on
     *   both platforms: on Android it is routed to the SDK's explicit `url`
     *   parameter, on iOS it rides inside the parameter map (where the native
     *   API expects it).
     * @returns A promise resolving to `true` if the identity signal was
     *   dispatched, `false` otherwise (including the blank-identifier case).
     *   Never rejects.
     *
     * @example
     * ```ts
     * import AcousticConnectRN from 'react-native-acoustic-connect'
     *
     * await AcousticConnectRN.logIdentity('Email', 'user@example.com')
     * ```
     */
    logIdentity(
        identifierName: string,
        identifierValue: string,
        signalType?: string,
        additionalParameters?: Record<string, string>
    ): Promise<boolean>

    // ── Push: APNs lifecycle (iOS) ──────────────────────────────────────────
    //
    // Push mode (automatic / manual / off) is configured in `ConnectConfig.json`
    // and enforced by the native SDK — there is no JS-side mode argument. In
    // automatic mode the SDK's swizzled delegate handles everything and these
    // forwarding calls are redundant-but-safe; in manual mode they are the only
    // path for events to reach the SDK.

    /**
     * Forwards the raw APNs device token to the Connect SDK (manual mode).
     *
     * Nitro maps `ArrayBuffer` ↔ `Data` natively; the bridge forwards the bytes
     * unchanged with no hex conversion and no validation.
     *
     * @param deviceToken Raw APNs device-token bytes from
     *   `didRegisterForRemoteNotificationsWithDeviceToken`.
     * @returns A promise resolving to `true` once the SDK accepted the token,
     *   or `false` if the SDK rejected the call (e.g. push not enabled). Never
     *   rejects.
     */
    pushDidRegisterWithToken(deviceToken: ArrayBuffer): Promise<boolean>

    /**
     * Forwards an APNs registration failure to the Connect SDK (manual mode).
     *
     * @param error Structured error; the bridge builds an `NSError` from it.
     * @returns A promise resolving to `true` once forwarded, `false` on failure.
     *   Never rejects.
     */
    pushDidFailToRegister(error: PushErrorInfo): Promise<boolean>

    /**
     * Forwards a received notification to the Connect SDK so it can log a
     * `pushReceived` signal (manual mode).
     *
     * The bridge branches on the push mode resolved from `ConnectConfig.json`:
     * manual mode forwards to the SDK and returns `true`; automatic/off mode
     * returns `false` (bridge error `EAC-RN-007`) without forwarding, because
     * the SDK's own delegate already handles delivery in automatic mode and
     * forwarding would double-log.
     *
     * @param userInfo The notification `userInfo` payload.
     * @returns A promise resolving to `true` if processed (manual mode), or
     *   `false` in automatic/off mode (`EAC-RN-007`). Never rejects.
     */
    pushDidReceiveNotification(userInfo: Record<string, string | number | boolean>): Promise<boolean>

    /**
     * Forwards a notification response (tap / action) to the Connect SDK so it
     * can run the built-in action and log a `pushAction` signal (manual mode).
     *
     * Same `EAC-RN-007` (`false`) behaviour in automatic mode as
     * {@link pushDidReceiveNotification}.
     *
     * @param actionIdentifier The response action identifier.
     * @param userInfo The notification `userInfo` payload.
     * @returns A promise resolving to `true` if processed (manual mode), or
     *   `false` in automatic/off mode (`EAC-RN-007`). Never rejects.
     */
    pushDidReceiveResponse(actionIdentifier: string, userInfo: Record<string, string | number | boolean>): Promise<boolean>

    // ── Push: permission management (cross-platform) ────────────────────────

    /**
     * Forwards externally-obtained permission state to the SDK.
     *
     * Tri-state `granted`: `true` granted, `false` denied, `null` not yet
     * determined. For `null` the bridge records the state but does not call the
     * SDK (it has no notion of forwarding "unknown").
     *
     * @param granted Tri-state permission value.
     * @param error Optional structured error accompanying a denial.
     * @returns A promise resolving to `true` once handled — including the
     *   `null`/not-determined case, which is intentionally accepted without
     *   forwarding to the SDK. `false` only if the SDK rejected a forwarded
     *   state. Never rejects.
     */
    pushDidReceiveAuthorization(granted: boolean | null, error?: PushErrorInfo): Promise<boolean>

    /**
     * Requests notification permission via the SDK, presenting the system prompt
     * when undetermined.
     *
     * Always resolves, never rejects — see {@link PushPermissionResult}.
     *
     * @returns The permission result.
     */
    pushRequestPermission(): Promise<PushPermissionResult>

    /**
     * Reads the current notification permission state without prompting.
     *
     * @returns Tri-state: `true` granted, `false` denied, `null` not determined.
     */
    pushGetPermissionState(): Promise<boolean | null>
}
