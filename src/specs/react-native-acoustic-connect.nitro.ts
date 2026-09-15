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

import { type AnyMap, type HybridObject } from 'react-native-nitro-modules'

// Define a named type for the anonymous object
export type KeyValueObject = {
    placeholder: string; // Add a placeholder property to avoid the "empty struct" error
    [key: string]: unknown;
};

/**
 * Payload accepted by {@link AcousticConnectRN.logSignal} — any JSON-shaped
 * object. Nested objects and arrays are allowed, so this is a superset of a
 * flat `Record<string, string | number | boolean>`.
 *
 * You do not need this type to call `logSignal`: an object literal is enough.
 * It exists for the times you want to name the payload — a helper parameter, a
 * shared constant — and is re-exported from the package root so you never have
 * to reach into `react-native-nitro-modules` for it:
 *
 * ```ts
 * import AcousticConnectRN, { type SignalValues } from 'react-native-acoustic-connect'
 *
 * const payload: SignalValues = { signalContent: { signalType: 'pageview' } }
 * AcousticConnectRN.logSignal(payload, 1)
 * ```
 *
 * @remarks
 * Aliases nitro's `AnyMap`, which is the only way to express arbitrary JSON in
 * a Nitro spec — a hand-rolled recursive type is rejected by nitrogen, which
 * tries to generate a struct for it. Nitrogen resolves the alias, so the
 * generated native bindings are identical either way; the indirection exists
 * purely to keep a third-party type name off our public API.
 */
export type SignalValues = AnyMap

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
    /**
     * Logs a named custom event with a flat set of key/value pairs.
     *
     * `values` is deliberately **flat** (scalars only), unlike
     * {@link logSignal}. The Android SDK's custom-event path is typed
     * `HashMap<String, String>` end to end (`Connect.logCustomEvent` →
     * `Tealeaf.logCustomEvent`), so there is no native route for nested
     * JSON. Widening this signature would compile but silently drop the
     * nesting on Android while preserving it on iOS — a cross-platform
     * divergence worse than the restriction. Use {@link logSignal} when the
     * payload needs structure.
     *
     * @param eventName Event name; appears in the posted JSON.
     * @param values Flat key/value pairs to attach to the event.
     * @param level Monitoring level for this event.
     * @returns `true` if the SDK **accepted the event for delivery** — not
     *   that the collector received it. Events are queued on device and posted
     *   in batches later, so nothing this call can return attests to delivery
     *   or to server-side acceptance. A `false` means the SDK rejected the
     *   event outright and nothing was queued; the bridge also logs that to
     *   logcat / os_log so it is visible without inspecting the return value.
     */
    logCustomEvent(eventName: string, values: Record<string, string | number | boolean>, level: number): boolean

    /**
     * Logs a signal payload.
     *
     * `values` accepts **arbitrary JSON** — nested objects and arrays, not
     * just scalars — because both native SDKs embed the payload verbatim:
     * iOS `CTSignalMessage` gates only on `NSJSONSerialization
     * isValidJSONObject:`, and Android `Connect.logSignal` takes an untyped
     * `HashMap<String, Any?>`. The bridge converts the map to each
     * platform's JSON representation without flattening or reshaping it.
     *
     * Scalar-only callers are unaffected: {@link SignalValues} is a superset
     * of `Record<string, string | number | boolean>`.
     *
     * @param values Signal payload. Objects, arrays, strings, numbers,
     *   booleans and `null` are all carried through.
     * @param level Monitoring level for this signal.
     * @returns `true` if the SDK **accepted the signal for delivery** — not
     *   that the collector received it, and not that it passed server-side
     *   schema validation. Signals are queued on device and posted later, so
     *   nothing this call can return attests to delivery. A `false` means the
     *   SDK rejected it and nothing was queued; the bridge logs that to
     *   logcat / os_log.
     *
     * @remarks
     * **Android version boundary — top-level numbers.** The Android SDK's
     * `JsonUtil.getHashValues` gained a `Number` branch in Connect Android
     * **11.0.24-beta**, so from that version a top-level numeric value is
     * carried. Earlier versions serialised only `String`, `Boolean`,
     * `JSONObject`, `JSONArray` and `byte[]` at the top level of the signal
     * map and dropped a top-level number. Numbers nested *inside* an object
     * or array were never affected, because the bridge builds those
     * `JSONObject`/`JSONArray` values itself, and iOS has always carried
     * top-level numbers normally. Both versions sit inside the
     * `[11.0.11, 12.0.0)` range this package accepts, so nest the number if
     * your integration pins a Connect Android version below 11.0.24-beta.
     *
     * @example Nested payload
     * ```ts
     * import AcousticConnectRN from 'react-native-acoustic-connect'
     *
     * AcousticConnectRN.logSignal(
     *   {
     *     signalContent: {
     *       signalType: 'pageview',
     *       url: 'https://app.example.com/dashboard',
     *       pageCategory: 'dashboard',
     *     },
     *     audience: [
     *       { name: 'Account Name', value: 'Acme Corp' },
     *       { name: 'Account ID', value: '4815162342' },
     *     ],
     *   },
     *   1
     * )
     * ```
     */
    logSignal(values: SignalValues, level: number): boolean
    logExceptionEvent(message: string, stackInfo: string, unhandled: boolean): boolean
    logLocation(): boolean
    logLocationWithLatitudeLongitude(latitude: number, longitude: number, level: number): boolean
    logClickEvent(target: number, controlId: string): boolean
    logTextChangeEvent(target: number, controlId: string, text: string | null | undefined): boolean
    setCurrentScreenName(logicalPageName: string): boolean
    logScreenViewContextLoad(logicalPageName: string | null | undefined, referrer:string | null | undefined): boolean
    logScreenViewContextUnload(logicalPageName: string | null | undefined, referrer:string | null | undefined): boolean
    /**
     * Captures the layout of the current screen.
     *
     * @param name  Screen name to associate with the capture.
     * @param delay Milliseconds to wait before capturing — the same unit as
     *   `CaptureLayoutDelay` in the layout config, on both platforms. A
     *   negative value means "use the `CaptureLayoutDelay` configured for this
     *   screen"; `0` captures immediately.
     *
     * Prefer `TLTRN.logScreenLayout`, which defaults to the configured delay.
     *
     * @returns For a `delay` of `0`, whether the capture itself succeeded. For
     *   any positive or configured delay, only that the capture was
     *   **scheduled** — the native deferred overload dispatches and returns
     *   immediately, so a `true` says nothing about what the capture found
     *   when it eventually ran. Failures after that point (no view controller
     *   resolved, config gating the capture off) surface in logcat / os_log,
     *   not here.
     */
    logScreenLayout(name: string, delay: number): boolean
    // New dialog event handling methods
    logDialogShowEvent(dialogId: string, dialogTitle: string, dialogType: string): boolean
    logDialogDismissEvent(dialogId: string, dismissReason: string): boolean
    logDialogButtonClickEvent(dialogId: string, buttonText: string, buttonIndex: number): boolean
    /**
     * Logs a custom event against a tracked dialog.
     *
     * `values` is flat for the same reason as {@link logCustomEvent} — this
     * routes to the native custom-event API, whose Android path carries string
     * values only.
     */
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
     *   signal payload. Only when omitted (`undefined`) does the bridge supply a
     *   default, and that default follows the resolved `signalType` — see
     *   **Required method attribute** below. An explicitly-provided map is used
     *   as-is, so passing an empty `{}` sends no extra parameters (the default is
     *   not merged in). A `'url'` entry is honoured uniformly on both platforms:
     *   on Android it is routed to the SDK's explicit `url` parameter, on iOS it
     *   rides inside the parameter map (where the native API expects it).
     * @returns A promise resolving to `true` if the identity signal was
     *   dispatched, `false` otherwise (including the blank-identifier case).
     *   Never rejects.
     *
     * ### Required method attribute
     *
     * Identity signals must carry a *method* attribute, and the key Connect
     * requires depends on the signal type:
     *
     * | `signalType`         | Required attribute   |
     * | -------------------- | -------------------- |
     * | `'loggedIn'`         | `loginMethod`        |
     * | `'accountRegistered'`| `registrationMethod` |
     *
     * Send the wrong key and the signal fails schema validation and is
     * discarded server-side — while this promise still resolves `true`, because
     * the native SDKs report only that the signal was queued. If you pass
     * `additionalParameters` explicitly, you own supplying the right key.
     *
     * @example Sign-in — `loginMethod` is required
     * ```ts
     * import AcousticConnectRN from 'react-native-acoustic-connect'
     *
     * await AcousticConnectRN.logIdentity('Email', 'user@example.com', 'loggedIn', {
     *   loginMethod: 'sso',
     * })
     *
     * // Omitting both arguments is equivalent to the above with
     * // `{ loginMethod: 'email' }` — the bridge defaults to a `loggedIn` signal.
     * await AcousticConnectRN.logIdentity('Email', 'user@example.com')
     * ```
     *
     * @example Registration — `registrationMethod` is required
     * ```ts
     * await AcousticConnectRN.logIdentity(
     *   'Email',
     *   'user@example.com',
     *   'accountRegistered',
     *   { registrationMethod: 'email' }
     * )
     * ```
     *
     * @returns `true` if the SDK **accepted the identity signal for
     *   delivery**. It does not mean the signal reached the collector, and it
     *   does not mean the collector kept it — a schema-invalid signal (the
     *   wrong method key above) is discarded server-side after resolving
     *   `true` here. Never rejects. A `false` means the SDK rejected the call
     *   locally, e.g. a blank identifier; the bridge logs that to logcat /
     *   os_log.
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
