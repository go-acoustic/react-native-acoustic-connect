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

package com.acousticconnectrn

import android.app.Activity
import android.app.AlertDialog
import android.app.Application
import android.app.Dialog
import android.content.Context
import android.content.ContextWrapper
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.text.TextUtils
import android.util.Log
import android.view.View
import android.view.View.OnFocusChangeListener
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.fragment.app.DialogFragment
import com.acoustic.connect.android.connectmod.Connect
import com.acoustic.connect.android.connectmod.Connect.TLF_ON_FOCUS_CHANGE_IN
import com.acoustic.connect.android.connectmod.Connect.TLF_ON_FOCUS_CHANGE_OUT
import com.acoustic.connect.android.connectmod.Connect.TLF_UI_KEYBOARD_DID_HIDE_NOTIFICATION
import com.acoustic.connect.android.connectmod.Connect.TLF_UI_KEYBOARD_DID_SHOW_NOTIFICATION
import com.acoustic.connect.android.connectmod.Connect.enable
import com.acoustic.connect.android.connectmod.Connect.getApplication
import com.acoustic.connect.android.connectmod.Connect.init
import com.acoustic.connect.android.connectmod.Connect.isEnabled
import com.acoustic.connect.android.connectmod.Connect.logEvent
import com.acoustic.connect.android.connectmod.Connect.logGeolocation
import com.acoustic.connect.android.connectmod.Connect.logLocationUpdateEventWithLatitude
import com.acoustic.connect.android.connectmod.Connect.logScreenLayout
import com.acoustic.connect.android.connectmod.Connect.logScreenview
import com.acoustic.connect.android.connectmod.Connect.onResume
import com.acoustic.connect.android.connectmod.Connect.registerFormField
import com.acoustic.connect.android.connectmod.Connect.resumeConnect
import com.acoustic.connect.android.connectmod.push.PushPermissionState
import com.acoustic.connect.android.connectmod.push.core.MobileServiceType
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.UIManagerHelper
import com.ibm.eo.EOCore
import com.ibm.eo.model.EOMonitoringLevel
import com.margelo.nitro.NitroModules.Companion.applicationContext
import com.margelo.nitro.acousticconnectrn.HybridAcousticConnectRNSpec
import com.margelo.nitro.acousticconnectrn.PushErrorInfo
import com.margelo.nitro.acousticconnectrn.PushPermissionResult
import com.margelo.nitro.acousticconnectrn.Variant_Boolean_String_Double
import com.margelo.nitro.acousticconnectrn.Variant_NullType_Boolean
import com.margelo.nitro.acousticconnectrn.Variant_NullType_String
import com.margelo.nitro.core.AnyMap
import com.margelo.nitro.core.ArrayBuffer
import com.margelo.nitro.core.NullType
import com.margelo.nitro.core.Promise
import com.tl.uic.Tealeaf
import com.tl.uic.model.ScreenviewType
import com.tl.uic.util.DialogUtil
import com.tl.uic.util.LayoutUtil
import com.tl.uic.util.keyboardview.KeyboardView
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.util.Objects


class HybridAcousticConnectRN : HybridAcousticConnectRNSpec(),
    LifecycleEventListener {

    // The Nitro C++ factory (`AcousticConnectRNOnLoad.cpp`) instantiates this
    // class with `getConstructor<()>()` — i.e. it expects a zero-arg
    // constructor. The React context can therefore not be passed in at
    // construction time; we resolve it lazily via `NitroModules.applicationContext`
    // (which is nullable until the React context attaches), guard every
    // access, and retry the lifecycle-listener registration on each
    // `enable()` call until it succeeds.

    // Touched only on the main looper. All read/write goes through
    // `runOnMain { ... }` (called from `init`, `enable()`, etc.), so the
    // unsynchronised access pattern is safe — the field's mutating thread
    // and reading thread are the same.
    private var lifecycleListenerRegistered = false

    init {
        Log.v(TAG, "[bridge] HybridAcousticConnectRN constructed")
        runOnMain {
            tryRegisterLifecycleListenerOnMain()
            // Cold-start auto-init: mirrors the iOS bridge's behaviour, where
            // `load()` runs inside the constructor's `Task { @MainActor in … }`
            // and initialises the SDK without waiting for an explicit JS
            // call. Without this, an Android cold start where the first
            // activity `onResume` fires before the lifecycle listener was
            // registered (slow JS bundle, RAM-bundle apps, dev hot reload)
            // would leave the SDK uninitialised until the next resume.
            maybeAutoInitOnMain()
        }
    }

    /**
     * Posts to the main looper. Used by every operation that touches
     * `lifecycleListenerRegistered`, registers a `LifecycleEventListener`,
     * or calls into `Connect.init`/`Connect.enable`/`Connect.disable` — so
     * all of those operations execute single-threaded on main, eliminating
     * read-then-write races on the registration flag.
     */
    private fun runOnMain(block: () -> Unit) {
        Handler(Looper.getMainLooper()).post(block)
    }

    /**
     * Idempotent: registers this hybrid as a React lifecycle listener the
     * first time `NitroModules.applicationContext` is non-null, then no-ops.
     *
     * MUST be called on the main looper. Callers funnel through
     * [runOnMain]; the read-then-write of `lifecycleListenerRegistered` is
     * therefore single-threaded by construction.
     */
    private fun tryRegisterLifecycleListenerOnMain() {
        if (lifecycleListenerRegistered) return
        val ctx = applicationContext
        if (ctx == null) {
            Log.v(TAG, "[bridge] React context not ready; lifecycle listener registration deferred")
            return
        }
        ctx.addLifecycleEventListener(this)
        lifecycleListenerRegistered = true
        Log.v(TAG, "[bridge] Lifecycle listener registered")
    }

    /**
     * Cold-start auto-init helper. Calls `Connect.init` + `Connect.enable`
     * if the SDK isn't already running and the React context is attached.
     * MUST be called on the main looper.
     *
     * Idempotent at every level:
     * - If the SDK is already enabled, returns immediately.
     * - If the context isn't ready, returns without acting (the subsequent
     *   `onHostResume` lifecycle callback or an explicit `enable()` from JS
     *   will retry).
     * - `Connect.init` and `Connect.enable` are themselves idempotent in
     *   the native SDK, so this co-existing with a later JS-driven
     *   `enable()` is safe.
     */
    private fun maybeAutoInitOnMain() {
        if (Connect.isEnabled()) return
        val app = resolveApplication() ?: return
        if (Connect.getApplication() == null) {
            Connect.init(app)
        }
        Connect.enable()
        maybeEnablePushOnMain(app)
        Log.i(TAG, "[bridge] SDK auto-initialised at bridge construction")
    }

    /**
     * Bootstraps the native Connect push transport when the push variant is
     * present. This is REQUIRED — it is not automatic. The `connect` /
     * `connect-push-fcm` AARs declare no ContentProvider or `Startup`
     * initializer, so nothing self-bootstraps `ConnectPush`. Its
     * `enable(...)` is the sole entry point that creates the FCM
     * [com.acoustic.connect.android.connectmod.push.PushService] transport,
     * sets `isInitialized = true`, registers the activity-lifecycle
     * callbacks, and constructs the `TokenUpdaterReceiver` that turns the
     * FCM `onNewToken` broadcast into a Connect PushRegistration. Without
     * this call the token broadcast is dropped and `sendToken()` no-ops on
     * `isInitialized == false`, so no registration ever reaches Connect.
     *
     * Gated by [isConnectPushFcmAvailable] so analytics-only
     * (`PushEnabled=false`) builds — which bundle no Firebase — never touch
     * the FCM transport classes. Idempotent: short-circuits once
     * `Connect.push.isInitialized()` is true, so it is safe to call from
     * every init path (construction auto-init, JS `enable()`, lifecycle
     * resume). `MobileServiceType.FCM` is hard-coded: FCM is the only push
     * provider on the JS surface (HMS was dropped — see deviation 4).
     *
     * MUST be called on the main looper, after `Connect.enable()`.
     */
    private fun maybeEnablePushOnMain(application: Application) {
        if (!isConnectPushFcmAvailable()) return
        if (Connect.push.isInitialized()) return
        val smallIconRes = resolvePushSmallIconRes(application)
        Connect.push.enable(application, true, smallIconRes, MobileServiceType.FCM) { e ->
            Log.w(TAG, "[bridge] push enable failed — ${e.message}")
        }
        Log.i(TAG, "[bridge] Connect push transport enabled (FCM)")
    }

    /**
     * Resolves the status-bar notification small-icon drawable for push.
     * Looks up `ic_stat_push` (the demo's committed monochrome icon, also
     * the `AndroidNotificationIconResName` convention) and falls back to the
     * app's launcher icon when absent, so consumers that didn't add a
     * dedicated push icon still get a valid resource rather than `0`.
     */
    private fun resolvePushSmallIconRes(application: Application): Int {
        val byName = application.resources.getIdentifier(
            "ic_stat_push",
            "drawable",
            application.packageName,
        )
        return if (byName != 0) byName else application.applicationInfo.icon
    }

    /**
     * Resolves the host app's `Application` from
     * `NitroModules.applicationContext`. Returns `null` (with a logged
     * warning) when the React context isn't attached yet — callers must
     * bail rather than NPE. Replaces the previous direct deref through a
     * constructor-injected `ReactApplicationContext` field, which was unsafe
     * because Nitro's factory passes a null JNI handle through Kotlin's
     * non-null platform type.
     */
    private fun resolveApplication(): Application? {
        val app = applicationContext?.applicationContext as? Application
        if (app == null) {
            Log.w(TAG, "[bridge] Application not yet available (NitroModules.applicationContext is null or its applicationContext is not an Application)")
        }
        return app
    }

    // region Gate-keeper API

    /**
     * Re-enables the Connect SDK after a prior `disable()`. All configuration
     * comes from `ConnectConfig.json` at the consumer's project root, which
     * `config.gradle` bakes into `ConnectBasicConfig.properties` /
     * `TealeafBasicConfig.properties` at build time.
     *
     * Idempotency is owned by the native SDK. `Connect.init` is safe to call
     * multiple times, and `Connect.enable` short-circuits once the SDK is
     * running. The bridge does not track its own enable signature — subsequent
     * JS calls just post another runnable that the native side will treat as
     * a no-op.
     *
     * Push wiring on Android is gated at build time by `Connect.PushEnabled`
     * in `ConnectConfig.json`, which `android/build.gradle` consults to
     * include the `connect-push-fcm` artifact. Token forwarding to Connect
     * runs through the host app's `FirebaseMessagingService`.
     *
     * @return true on accepted dispatch, false if no application context.
     */
    override fun enable(): Boolean {
        Log.i(TAG, "[bridge] enable() called from JS")
        logResolvedPushAvailability()

        // All work happens on the main looper so the lifecycle-listener
        // registration flag is touched single-threaded and we don't race
        // with the `init { runOnMain { … } }` registration path. Returning
        // `true` reflects "accepted dispatch", not "succeeded"; the actual
        // work logs its own success or failure on main.
        runOnMain {
            tryRegisterLifecycleListenerOnMain()
            val application = resolveApplication() ?: run {
                Log.w(TAG, "[bridge] enable() bailed — Application still null on main thread")
                return@runOnMain
            }
            Connect.init(application)
            Connect.enable()
            maybeEnablePushOnMain(application)
            Log.i(TAG, "[bridge] SDK initialised")
        }
        return true
    }

    /**
     * Disables the Connect SDK. Idempotent — the underlying `Connect.disable()`
     * is safe to call repeatedly on the native side; this override always
     * returns `true` for an accepted dispatch.
     */
    override fun disable(): Boolean {
        Log.i(TAG, "[bridge] disable() called from JS")
        runOnMain {
            Connect.disable()
            Log.i(TAG, "[bridge] SDK disabled")
        }
        return true
    }

    // region Push (Android)
    //
    // The shared Nitro spec declares these push methods on both platforms.
    // Once the bridge bootstraps the native push transport via
    // [maybeEnablePushOnMain] (`Connect.push.enable(..., MobileServiceType.FCM)`
    // at SDK init), the native SDK owns the rest of the push lifecycle:
    // Connect's own FirebaseMessagingService (shipped in connect-push-fcm)
    // handles inbound delivery and PushReceived / PushAction logging, and the
    // `TokenUpdaterReceiver` registered by `enable(...)` turns the FCM
    // `onNewToken` broadcast into a Connect PushRegistration. That bootstrap
    // is NOT automatic — the AARs declare no ContentProvider / Startup
    // initializer, so without the `enable(...)` call no token ever registers.
    //
    // After bootstrap there is no manual JS-forwarding API on Android (unlike
    // iOS), so every JS→native forwarder below is a no-op that reports
    // "handled", kept only for cross-platform API symmetry:
    //   - pushDidReceiveNotification, pushDidReceiveResponse,
    //     pushDidRegisterWithToken, pushDidFailToRegister,
    //     pushDidReceiveAuthorization
    //
    // The only Android-relevant runtime interaction is permission wiring:
    //   - pushRequestPermission / pushGetPermissionState — POST_NOTIFICATIONS
    //
    // pushGetToken / pushGetTokenAsync are intentionally NOT on the surface —
    // parked (the native transport registers the token with Connect once
    // enabled; no JS accessor is needed). None of these methods reject.

    /**
     * iOS-primary forwarder. On Android the FCM token is captured and
     * registered with Connect by the native transport once it is bootstrapped
     * via [maybeEnablePushOnMain] (the `TokenUpdaterReceiver` set up by
     * `Connect.push.enable(...)` consumes the `onNewToken` broadcast), so this
     * JS forwarder is a no-op that reports "handled". Never rejects.
     */
    override fun pushDidRegisterWithToken(deviceToken: ArrayBuffer): Promise<Boolean> {
        Log.d(TAG, "[bridge] pushDidRegisterWithToken: no-op on Android (native transport owns token registration once enabled)")
        return Promise.resolved(true)
    }

    /**
     * iOS-primary forwarder. Android surfaces registration failures through the
     * native SDK's own error path, so this is a no-op. Never rejects.
     */
    override fun pushDidFailToRegister(error: PushErrorInfo): Promise<Boolean> {
        Log.d(TAG, "[bridge] pushDidFailToRegister: no-op on Android (domain=${error.domain}, code=${error.code})")
        return Promise.resolved(true)
    }

    /**
     * iOS-primary forwarder. Android has **no** manual push-delivery API: the
     * native SDK's own `FirebaseMessagingService` (shipped in `connect-push-fcm`)
     * receives inbound messages and logs the PushReceived signal automatically.
     * There is no sanctioned JS-forwarding entry point on Android — and outside
     * Connect's push transport there is no registered device to attribute a
     * PushReceived to — so this is a no-op that reports "handled". Kept for
     * cross-platform API symmetry with iOS (where it forwards to the SDK in
     * manual mode). Never rejects.
     */
    override fun pushDidReceiveNotification(userInfo: Map<String, Variant_Boolean_String_Double>): Promise<Boolean> {
        Log.d(TAG, "[bridge] pushDidReceiveNotification: no-op on Android (native FCM service owns delivery + logging)")
        return Promise.resolved(true)
    }

    /**
     * iOS-primary forwarder. Tap (PushAction) handling on Android routes through
     * the native SDK's `NotificationActionActivity`, so this is a no-op. Never
     * rejects.
     */
    override fun pushDidReceiveResponse(
        actionIdentifier: String,
        userInfo: Map<String, Variant_Boolean_String_Double>,
    ): Promise<Boolean> {
        Log.d(TAG, "[bridge] pushDidReceiveResponse: no-op on Android (native SDK handles tap actions)")
        return Promise.resolved(true)
    }

    /**
     * No-op on Android. Permission state is auto-detected on every activity
     * start by the SDK's ActivityLifecycleHandler, so an externally-supplied
     * authorization result needs no forwarding. Kept for API symmetry with iOS
     * (where it forwards to the native SDK). Never rejects.
     */
    override fun pushDidReceiveAuthorization(granted: Variant_NullType_Boolean?, error: PushErrorInfo?): Promise<Boolean> {
        Log.d(TAG, "[bridge] pushDidReceiveAuthorization: no-op on Android (state self-heals via lifecycle)")
        return Promise.resolved(true)
    }

    /**
     * Requests the POST_NOTIFICATIONS permission. Delegates to
     * [com.acoustic.connect.android.connectmod.push.PushApi.requestNotificationPermission],
     * which fully manages the system dialog and the Activity Result registration,
     * then resolves from its one-shot callback. On pre-TIRAMISU devices the SDK
     * resolves `granted = true` immediately.
     *
     * **Never rejects.** If no foreground [ComponentActivity] is available, or
     * the SDK call throws, it resolves `{ granted: false, error: <reason> }`.
     *
     * Intentionally NOT gated by [isConnectPushFcmAvailable]. The permission
     * API ([PushApi]/`ConnectPush` and the `NotificationPermission*` classes)
     * ships in the core `connect` artifact, which is always on the classpath —
     * the `connect-push-fcm` variant pulls `connect` in transitively (see
     * `android/build.gradle`). So `Connect.push` is a non-null core object, not
     * a stub, and accessing it cannot raise `NoClassDefFoundError` from a
     * missing FCM artifact. POST_NOTIFICATIONS is an OS-level concern that is
     * meaningful regardless of whether FCM message delivery is bundled; gating
     * it on the FCM probe would wrongly disable a working capability in
     * analytics-only (`PushEnabled=false`) builds. The only FCM-adjacent path
     * the SDK runs from here — `sendToken()` in the result callback — is itself
     * guarded by the SDK's `isInitialized()` and no-ops when transport is absent.
     */
    override fun pushRequestPermission(): Promise<PushPermissionResult> {
        val promise = Promise<PushPermissionResult>()
        runOnMain {
            // Re-read the foreground activity inside the main-looper block: it can
            // change between the bridge call and this dispatch (e.g. a rotation /
            // configuration change). Guard against a finishing or destroyed
            // activity, not just null — handing such an activity to the SDK lets it
            // register an ActivityResultLauncher whose result callback never fires,
            // which would hang this Promise forever. Resolving deterministically
            // here is preferable to a silent never-resolving Promise.
            val activity = getCurrentActivity() as? ComponentActivity
            if (activity == null || activity.isFinishing || activity.isDestroyed) {
                Log.w(TAG, "[bridge] pushRequestPermission: no usable foreground ComponentActivity")
                promise.resolve(
                    PushPermissionResult(false, Variant_NullType_String.create("no-foreground-activity")),
                )
                return@runOnMain
            }
            try {
                // The `granted` callback is always delivered on the main thread:
                // either synchronously here (pre-TIRAMISU / already-granted paths,
                // still on this looper) or via AndroidX ActivityResultRegistry,
                // which dispatches results on the main thread. Promise.resolve is
                // additionally thread-agnostic — it delegates to native, which
                // marshals onto the JS thread — so resolution is safe regardless of
                // the calling thread.
                Connect.push.requestNotificationPermission(activity) { granted ->
                    promise.resolve(PushPermissionResult(granted, null))
                }
            } catch (e: Exception) {
                Log.w(TAG, "[bridge] pushRequestPermission: request failed — ${e.message}")
                promise.resolve(
                    PushPermissionResult(false, Variant_NullType_String.create(e.message ?: "permission-request-failed")),
                )
            }
        }
        return promise
    }

    /**
     * Returns the current POST_NOTIFICATIONS permission as the cross-platform
     * tri-state: `true` granted, `false` denied, `null` not yet
     * determined. Maps [PushPermissionState] from the native SDK. Does not
     * prompt. Never rejects — resolves `null` if the context is unavailable or
     * the SDK call throws.
     *
     * Runs on the main looper (via [runOnMain]), matching every other
     * `Connect.push.*` invocation in this bridge rather than executing on the
     * Nitro bridge thread the HybridObject method is dispatched on. Besides
     * keeping the threading contract consistent, this serialises the call with
     * [pushRequestPermission]'s SDK callback: both ultimately touch the same
     * notification-permission `SharedPreferences` store (the SDK's
     * `getPushPermissionState` does a read-then-write to reconcile a
     * Settings-side revocation), so funnelling both through main avoids an
     * interleaved read/write across threads.
     *
     * Like [pushRequestPermission], this is intentionally NOT gated by
     * [isConnectPushFcmAvailable] — the permission API lives in the core
     * `connect` artifact (always on the classpath) and never touches the FCM
     * transport classes, so there is no missing-artifact / stub-object risk.
     */
    override fun pushGetPermissionState(): Promise<Variant_NullType_Boolean> {
        val promise = Promise<Variant_NullType_Boolean>()
        runOnMain {
            val context = applicationContext?.applicationContext
            if (context == null) {
                promise.resolve(Variant_NullType_Boolean.create(NullType.NULL))
                return@runOnMain
            }
            try {
                // Redundant against today's 3-value enum, but kept deliberately
                // for forward-compatibility with future SDK enum values (see the
                // `else` branch below), so silence the redundancy warning.
                @Suppress("REDUNDANT_ELSE_IN_WHEN")
                val triState = when (Connect.push.getPushPermissionState(context)) {
                    PushPermissionState.GRANTED -> Variant_NullType_Boolean.create(true)
                    PushPermissionState.DENIED -> Variant_NullType_Boolean.create(false)
                    PushPermissionState.NOT_DETERMINED -> Variant_NullType_Boolean.create(NullType.NULL)
                    // PushPermissionState is a Connect-SDK enum that may gain
                    // values in a future release. An explicit `else` keeps this
                    // forward-compatible: it avoids a compile break if the bridge
                    // is rebuilt against an SDK with a new state, and replaces the
                    // synthetic NoWhenBranchMatchedException (binary-incompat case:
                    // bridge built against the old enum, run against a newer one)
                    // with a deliberate fallback. Any unknown/new state maps to the
                    // tri-state `null` ("not determined") — the safest default.
                    else -> Variant_NullType_Boolean.create(NullType.NULL)
                }
                promise.resolve(triState)
            } catch (e: Exception) {
                Log.w(TAG, "[bridge] pushGetPermissionState: query failed — ${e.message}")
                promise.resolve(Variant_NullType_Boolean.create(NullType.NULL))
            }
        }
        return promise
    }

    // endregion

    /**
     * Checks whether the `connect-push-fcm` artifact is on the classpath and
     * logs the result. The artifact is gated by `Connect.PushEnabled` in
     * `ConnectConfig.json` via `android/build.gradle`'s conditional
     * `implementation` clause. A missing artifact when `PushEnabled` was set
     * to true points at a build-pipeline issue (didn't run `config.gradle`
     * or the conditional didn't fire). This method also gates the push
     * wire-up against the resolved Connect push API on Android.
     */
    private fun logResolvedPushAvailability() {
        val pushAvailable = isConnectPushFcmAvailable()
        Log.i(TAG, "[config] connect-push-fcm on classpath: $pushAvailable")
        if (!pushAvailable) {
            Log.i(TAG, "[config] Push is not active on Android in this build. To enable, set Connect.PushEnabled=true in ConnectConfig.json and re-sync Gradle to include connect-push-fcm.")
        }
    }

    private fun isConnectPushFcmAvailable(): Boolean {
        // Probe a known class shipped by the connect-push-fcm artifact. The
        // exact class lives in the Connect Android SDK's push module. This
        // Class.forName probe is robust to
        // package-name changes because it falls through silently when the
        // class is missing (which is the default in a no-push build).
        return try {
            Class.forName(CONNECT_PUSH_FCM_PROBE_CLASS)
            true
        } catch (e: ClassNotFoundException) {
            false
        }
    }

    // endregion

    /**
     * Sets the module's boolean configuration item from AdvancedConfig.json or BasicConfig.properties that matches the specified key.
     *
     * @param key        Map Key.
     * @param value      Boolean Value.
     * @param moduleName The class name of the module's EOLifecycleObject for which the configuration item is referencing.
     * @return True if the operation was successful, false otherwise.
     */
    override fun setBooleanConfigItemForKey(
        key: String,
        value: Boolean,
        moduleName: String
    ): Boolean {
        val result: Boolean =
            EOCore.updateConfig(key, value.toString(), EOCore.getLifecycleObject(moduleName))
        return result
    }

    /**
     * Sets the module's string configuration item from AdvancedConfig.json or BasicConfig.properties that matches the specified key.
     *
     * @param key        Map Key.
     * @param value      String Value.
     * @param moduleName The class name of the module's EOLifecycleObject for which the configuration item is referencing.
     * @return True if the operation was successful, false otherwise.
     */
    override fun setStringItemForKey(
        key: String,
        value: String,
        moduleName: String
    ): Boolean {
        val result = EOCore.updateConfig(key, value, EOCore.getLifecycleObject(moduleName))
        return result
    }

    /**
     * Sets the module's number configuration item from AdvancedConfig.json or BasicConfig.properties that matches the specified key.
     *
     * @param key        Map Key.
     * @param value      Number Value.
     * @param moduleName The class name of the module's EOLifecycleObject for which the configuration item is referencing.
     * @return True if the operation was successful, false otherwise.
     */
    override fun setNumberItemForKey(
        key: String,
        value: Double,
        moduleName: String
    ): Boolean {
        // Rendered through formatJsNumber, not Double.toString: EOCore stores
        // config items as strings, and a JS 0 spelled "0.0" is not the same
        // token as the "0" the JSON config files carry, so a consumer setting
        // a whole-number item at runtime wrote a value that no longer matched
        // what the same key looks like on iOS (a native number) or on disk.
        val result = EOCore.updateConfig(key, formatJsNumber(value), EOCore.getLifecycleObject(moduleName))
        return result
    }

    /**
     * Sets the module's configuration item from AdvancedConfig.json or BasicConfig.properties that matches the specified key.
     *
     * @param key        Map Key.
     * @param value      Map Value.
     * @param moduleName The class name of the module's EOLifecycleObject for which the configuration item is referencing.
     * @param promise    Javascript Promise interface.
     */
    override fun setConfigItemForKey(
        key: String,
        value: Variant_Boolean_String_Double,
        moduleName: String
    ): Boolean {
        val result =
            EOCore.updateConfig(key, variantToString(value), EOCore.getLifecycleObject(moduleName))
        return result
    }

    /**
     * Gets the module's configuration item from AdvancedConfig.json or BasicConfig.properties that matches the specified key as a BOOL value.
     *
     * @param theDefault In case no value if found, use this value as default.
     * @param key        Key value.
     * @param moduleName The class name of the module's EOLifecycleObject for which the configuration item is referencing.
     * @return True if the operation was successful, false otherwise.
     */
    override fun getBooleanConfigItemForKey(
        theDefault: Boolean,
        key: String,
        moduleName: String
    ): Boolean {
        val result = EOCore.getConfigItemBoolean(key, EOCore.getLifecycleObject(moduleName))
        if (result == false) {
            return theDefault
        }
        return result
    }

    /**
     * Gets the module's configuration item from AdvancedConfig.json or BasicConfig.properties that matches the specified key as a String value.
     *
     * @param theDefault In case no value if found, use this value as default.
     * @param key        Key value.
     * @param moduleName The class name of the module's EOLifecycleObject for which the configuration item is referencing.
     * @return String value if the operation was successful, null otherwise.
     */
    override fun getStringItemForKey(theDefault: String, key: String, moduleName: String): Variant_NullType_String? {
        var result = EOCore.getConfigItemString(key, EOCore.getLifecycleObject(moduleName))
        if (TextUtils.isEmpty(result)) {
            result = theDefault
        }
        return if (result != null) Variant_NullType_String.create(result) else null
    }

    /**
     * Gets the module's configuration item from AdvancedConfig.json or BasicConfig.properties that matches the specified key as a double value.
     *
     * @param theDefault In case no value if found, use this value as default.
     * @param key        Key value.
     * @param moduleName The class name of the module's EOLifecycleObject for which the configuration item is referencing.
     * @return Double value if the operation was successful, 0.0 otherwise.
     */
    override fun getNumberItemForKey(theDefault: Double, key: String, moduleName: String): Double {
        var result = EOCore.getConfigItemDouble(key, EOCore.getLifecycleObject(moduleName))
        if (result == -1.0) {
            result = theDefault
        }
        return result
    }

    /**
     * Logs a custom event with the specified name and values.
     *
     * @param eventName The name of the event to be logged this will appear in the posted json.
     * @param values    A map of values associated with the event.
     * @param level     Set a custom log level to the event. This will override the configured log level for that event.
     * @return True if the operation was successful, false otherwise.
     */
    override fun logCustomEvent(
        eventName: String,
        values: Map<String, Variant_Boolean_String_Double>,
        level: Double
    ): Boolean {
        val result = Connect.logCustomEvent(eventName, convertToMap(values), level.toInt())
        return warnIfRejected(result, "logCustomEvent", eventName)
    }

    /**
     * Logs a signal with the specified values.
     *
     * Takes an [AnyMap] rather than a map of Nitro variants so JS callers can
     * send arbitrary JSON — nested objects and arrays included. See
     * [toSignalPayload] for why the nesting has to be rebuilt as
     * [JSONObject]/[JSONArray] rather than handed over as plain Kotlin
     * collections.
     *
     * @param values The signal payload; objects, arrays and scalars are all carried through.
     * @param level  Set a custom log level to the event. This will override the configured log level for that event.
     * @return True if the operation was successful, false otherwise.
     */
    override fun logSignal(
        values: AnyMap,
        level: Double
    ): Boolean {
        val result = Connect.logSignal(toSignalPayload(values.toHashMap()), level.toInt())
        return warnIfRejected(result, "logSignal")
    }

    /**
     * Surfaces a `false` returned by a native logging call, and passes it
     * through unchanged.
     *
     * The bridge's boolean means "the SDK accepted this for delivery", never
     * "the collector received it" — nothing on the device knows the latter. But
     * the *accepted* half was itself invisible: a `false` propagated to JS as a
     * bare return value that the wrapper's callers almost never inspect, with
     * nothing in logcat. Callers reporting "the event never arrived" had no way
     * to tell a rejected call from a delivery problem. One line at warn level
     * distinguishes them.
     *
     * Deliberately does not change the return value or throw: an analytics
     * bridge must not turn a rejected event into an app-visible failure.
     *
     * @param result The value the native call returned.
     * @param api    Name of the bridge method, for the log line.
     * @param detail Optional extra identifier, e.g. an event name.
     * @return [result], unchanged.
     */
    private fun warnIfRejected(result: Boolean, api: String, detail: String? = null): Boolean {
        if (!result) {
            val suffix = if (detail != null) " ($detail)" else ""
            Log.w(
                TAG,
                "[bridge] $api$suffix: the Connect SDK did not accept the event; nothing was queued " +
                    "for delivery. Check that the SDK is enabled and the payload is valid."
            )
        }
        return result
    }

    /**
     * Logs a user identity so device activity can be associated with a known
     * Connect contact. Wraps [Connect.logIdentificationEvent].
     *
     * Returns a [Promise] to match the cross-platform spec — the iOS identity
     * API is main-actor isolated and async. The native call is synchronous and
     * returns false (emitting no signal) when either identifier is blank, so no
     * extra guard is needed here.
     *
     * A `"url"` entry in [additionalParameters] is routed to the SDK's explicit
     * `url` parameter so the JS surface matches iOS, where `url` rides inside the
     * parameter map. When absent, the SDK's own default URL applies.
     *
     * @param identifierName Identifier name, e.g. "Email".
     * @param identifierValue Identifier value, e.g. "user@example.com".
     * @param signalType Optional signal type; defaults to "loggedIn" when omitted.
     * @param additionalParameters Optional extra key/value pairs merged into the
     *   signal. Defaults, only when null (omitted), to the method attribute the
     *   resolved signal type requires — `{ "loginMethod": "email" }` for
     *   `loggedIn`, `{ "registrationMethod": "email" }` otherwise (see
     *   [defaultIdentityParameters]). An explicit map — including an empty one
     *   — is used as-is.
     * @return A promise resolving to true if the signal was queued, false otherwise.
     */
    override fun logIdentity(
        identifierName: String,
        identifierValue: String,
        signalType: String?,
        additionalParameters: Map<String, String>?
    ): Promise<Boolean> {
        val resolvedSignalType = signalType ?: "loggedIn"
        val params = additionalParameters ?: defaultIdentityParameters(resolvedSignalType)
        val result = params["url"]?.let { url ->
            Connect.logIdentificationEvent(
                identifierName,
                identifierValue,
                url,
                resolvedSignalType,
                params - "url"
            )
        } ?: Connect.logIdentificationEvent(
            identifierName = identifierName,
            identifierValue = identifierValue,
            signalType = resolvedSignalType,
            additionalParameters = params
        )
        // An identity signal that the SDK accepts can still be rejected
        // downstream by schema validation — a mismatched method attribute has
        // cost a customer 22 signals while every call reported success. The
        // bridge cannot see that; it can at least report the half it does see.
        return Promise.resolved(warnIfRejected(result, "logIdentity", resolvedSignalType))
    }

    /**
     * Logs an exception event with the specified message and stack information.
     *
     * @param message    The message associated with the exception.
     * @param stackInfo  The stack information associated with the exception.
     * @param unhandled  Indicates whether the exception is unhandled.
     * @return True if the operation was successful, false otherwise.
     */
    override fun logExceptionEvent(message: String, stackInfo: String, unhandled: Boolean): Boolean {
        val result = Connect.logExceptionEvent("React Plugin", message, stackInfo, unhandled)
        return result
    }

    /**
     * Logs the current location.
     *
     * @return True if the operation was successful, false otherwise.
     */
    override fun logLocation(): Boolean {
        val result = logGeolocation(EOMonitoringLevel.kEOMonitoringLevelInfo.value)
        return result
    }

    /**
     * Logs the current location with the specified latitude and longitude.
     *
     * @param latitude  The latitude of the location.
     * @param longitude The longitude of the location.
     * @param level     Set a custom log level to the event. This will override the configured log level for that event.
     * @return True if the operation was successful, false otherwise.
     */
    override fun logLocationWithLatitudeLongitude(
        latitude: Double,
        longitude: Double,
        level: Double
    ): Boolean {
        val result = logLocationUpdateEventWithLatitude(latitude, longitude, level.toInt())
        return result
    }

    /**
     * Log click events on react native control.
     *
     * @param target    Target id of the control.
     * @param controlId Accessibility ID(virtual id).
     * @return True if the operation was successful, false otherwise.
     */
    override fun logClickEvent(target: Double, controlId: String): Boolean {
        val viewTag = target.toInt()
        return try {
            val ctx = applicationContext ?: return false
            val uiManager = UIManagerHelper.getUIManagerForReactTag(ctx, viewTag)
                ?: return false
            val view = uiManager.resolveView(viewTag) ?: return false

            Handler(Looper.getMainLooper()).post {
                val activity = getCurrentActivity() ?: return@post
                if (view is EditText) {
                    addFocusAndRegister(view, null, activity)
                } else if (TextUtils.isEmpty(controlId)) {
                    logEvent(view, "click")
                } else {
                    logEvent(view, "click", controlId)
                }
            }
            true
        } catch (e: Exception) {
            Log.v(TAG, "logClickEvent error: ${e.message}", e)
            false
        }
    }

    /**
     * Log click events on react native control.
     *
     * @param target    Target id of the control.
     * @return True if the operation was successful, false otherwise.
     */
    fun logClickEvent(target: Double): Boolean {
        val viewTag = target.toInt()
        return try {
            val ctx = applicationContext ?: return false
            val uiManager = UIManagerHelper.getUIManagerForReactTag(ctx, viewTag)
                ?: return false
            val view = uiManager.resolveView(viewTag) ?: return false

            Handler(Looper.getMainLooper()).post {
                val activity = getCurrentActivity() ?: return@post
                if (view is EditText) {
                    addFocusAndRegister(view, null, activity)
                } else {
                    logEvent(view, "click")
                }
            }
            true
        } catch (e: Exception) {
            Log.v(TAG, "logClickEvent error: ${e.message}")
            false
        }
    }

    /**
     * Log EditText change event.
     *
     * @param target    A valid native View Id for lookup.
     * @param controlId Accessibility ID(virtual id).
     * @param text      The input string.
     * @return True if the operation was successful, false otherwise.
     */
    override fun logTextChangeEvent(target: Double, controlId: String, text: Variant_NullType_String?): Boolean {
        val viewTag = target.toInt()
        return try {
            val ctx = applicationContext ?: return false
            val uiManager = UIManagerHelper.getUIManagerForReactTag(ctx, viewTag)
                ?: return false
            val view = uiManager.resolveView(viewTag) ?: return false

            Handler(Looper.getMainLooper()).post {
                val activity = getCurrentActivity() ?: return@post
                if (view is EditText && view.onFocusChangeListener == null) {
                    logEvent(view, TLF_ON_FOCUS_CHANGE_IN, controlId)
                    addFocusAndRegister(view, controlId, activity)
                }
            }
            true
        } catch (e: Exception) {
            Log.v(TAG, "logTextChangeEvent error: ${e.message}")
            false
        }
    }

    /**
     * Requests that the framework save the current application page name.
     *
     * @param logicalPageName The logical page name to be set.
     * @return True if the operation was successful, false otherwise.
     */
    /**
     * Whether the bridge may touch capture at all.
     *
     * `disable()` reaches `Tealeaf.disable()`, which unregisters the activity
     * lifecycle callbacks and clears the enabled flag — enough on iOS, where
     * `<Connect>` only advances the current screen name. On Android the same
     * component also drives capture explicitly on every navigation
     * (`logScreenViewPageName` + `logScreenLayout`), and those paths used to run
     * regardless of the flag: `setCurrentScreenName` calls through to
     * `Tealeaf.resumeTealeaf`, which resumes logging, and `logScreenLayout`
     * captured a full layout. The net effect was that `disable()` silenced
     * capture on iOS but not on Android, for an app doing nothing unusual.
     *
     * Checked here rather than in JS so every caller is covered, including apps
     * that call the bridge methods directly.
     */
    private fun isCaptureAllowed(): Boolean = Connect.isEnabled()

    override fun setCurrentScreenName(logicalPageName: String): Boolean {
        // resumeConnect resumes logging, so this must not run while disabled.
        if (!isCaptureAllowed()) return false
        val result = resumeConnect(getCurrentActivity(), logicalPageName, false)
        return result
    }

    /**
     * Requests that the framework logs an screen load event.
     *
     * @param logicalPageName The logical page name to be set.
     * @param referrer        The referrer for the screen view.
     * @return True if the operation was successful, false otherwise.
     */
    override fun logScreenViewContextLoad(logicalPageName: Variant_NullType_String?, referrer: Variant_NullType_String?): Boolean {
        // Emits a screenview message; nothing should reach the queue while disabled.
        if (!isCaptureAllowed()) return false
        // No activity means nothing to log a screenview against. This used to be
        // a force-unwrap, which turned a backgrounded or not-yet-attached activity
        // into a crash; the sample now calls this method directly, so the path is
        // easy to reach from JS.
        val activity = getCurrentActivity() ?: return false
        return logScreenview(activity, logicalPageName?.asSecondOrNull().toString(), ScreenviewType.LOAD, referrer?.asSecondOrNull())
    }

    /**
     * Requests that the framework logs an screen unload event.
     *
     * @param logicalPageName The logical page name to be set.
     * @param referrer        The referrer for the screen view.
     * @return True if the operation was successful, false otherwise.
     */
    override fun logScreenViewContextUnload(logicalPageName: Variant_NullType_String?, referrer: Variant_NullType_String?): Boolean {
        // Emits a screenview message; nothing should reach the queue while disabled.
        if (!isCaptureAllowed()) return false
        // No activity means nothing to log a screenview against. This used to be
        // a force-unwrap, which turned a backgrounded or not-yet-attached activity
        // into a crash; the sample now calls this method directly, so the path is
        // easy to reach from JS.
        val activity = getCurrentActivity() ?: return false
        return logScreenview(activity, logicalPageName?.asSecondOrNull().toString(), ScreenviewType.UNLOAD, referrer?.asSecondOrNull())
    }

    /**
     * Log Current Screen Layout using native side background thread.
     *
     * @param name  Page name or title e.g. "Login View Controller"; Must not be empty.
     * @param delay The delay in milliseconds before logging the event. A negative
     *              value means "use the `CaptureLayoutDelay` configured for this
     *              screen", which is what the JS wrapper sends when the caller
     *              names no delay.
     * @return True if the operation was successful, false otherwise.
     */
    override fun logScreenLayout(name: String, delay: Double): Boolean {
        // The wrapper calls this on every Android navigation.
        if (!isCaptureAllowed()) return false
        // Advisory on purpose: a false here means the screen name did not advance,
        // which is not a reason to skip the screenview and layout that follow — they
        // are what the caller asked for. Treating it as fatal would suppress capture
        // in cases that capture fine today. The guard inside setCurrentScreenName is
        // redundant against the check above and deliberately left in, so the method
        // stays safe for callers that reach it directly.
        setCurrentScreenName(name)
        // The 3-arg overload takes a nullable Activity, so this one is safe to pass
        // through — unlike the 4-arg overload the context methods use.
        logScreenview(getCurrentActivity(), name, ScreenviewType.LOAD)
        var result = false
        // The layout capture below needs a real activity: it used to go through
        // Objects.requireNonNull, which threw when the activity had gone away
        // between the check above and here. Skip the capture instead and report
        // false — this runs on every Android navigation, so a throw here is a
        // crash on an ordinary screen change.
        val activity = getCurrentActivity()
        if (activity != null && LayoutUtil.canCaptureUserEvents(null, name)) {
            result = logAutomaticScreenLayout(
                activity,
                name,
                resolveCaptureLayoutDelayMs(name, delay)
            )
        }
        return result
    }

    /**
     * Captures the layout of [activity] as an *automatic* capture — the kind
     * the wrapper triggers itself, on navigation or behind a dialog — rather
     * than a manual `logScreenLayout` API call from the host app.
     *
     * Every wrapper-initiated capture must go through here, because the
     * distinction is what makes the configured `ScreenShot` value reach the
     * native screenshot gate at all:
     *
     * - `Connect`'s four-argument overload hardcodes `manualLog = true`, and
     *   the native gate reads the configured `ScreenShot` only on the
     *   `manualLog = false` branch. Passing a literal `true` for the screenshot
     *   flag — which every wrapper call site used to do — therefore took the
     *   manual branch unconditionally, so `ScreenShot: false` could not be
     *   honoured from config and a full-page image shipped in every layout
     *   message regardless. Hence the five-argument overload, with
     *   `manualLog = false`.
     * - [LayoutUtil.canTakeScreenShot] resolves the same merged layout rule the
     *   native automatic path uses (global settings as a baseline, any
     *   per-screen rule applied over them). It is preferred over reading
     *   `ScreenShot` directly because it is `has()`-guarded: a per-screen rule
     *   that omits the key defaults to capturing rather than throwing a
     *   `JSONException`, which higher up is swallowed and costs the whole
     *   layout message. Its first argument may be null while the page name is
     *   non-empty, the same pattern as `canCaptureUserEvents(null, name)`.
     *
     * Note `CaptureScreenshotOn` is not consulted anywhere on Android: its only
     * native reader has no callers, so `ScreenShot` is the one wired-up switch.
     *
     * [activity] is nullable to match the five-argument overload; callers that
     * need a non-null one check or assert before calling.
     */
    private fun logAutomaticScreenLayout(
        activity: Activity?,
        name: String,
        delayMs: Int
    ): Boolean {
        return logScreenLayout(
            activity,
            name,
            delayMs,
            false,
            LayoutUtil.canTakeScreenShot(null, name)
        )
    }

    /**
     * Resolves the capture delay, in milliseconds, to apply for [name].
     *
     * A non-negative [delay] is the caller's explicit choice and passes
     * straight through. A negative one defers to `CaptureLayoutDelay` in the
     * layout config, which is what makes that setting reach the React Native
     * wrapper at all — the wrapper used to hardcode 0 here, so the capture
     * fired at the start of the screen transition and the configured value
     * was inert.
     *
     * [LayoutUtil.getLayoutInfo] returns the merged rule for the screen: the
     * global settings as a baseline with any per-screen rule applied over
     * them, so this picks up either without re-implementing the precedence.
     * It reads the config off disk, so a malformed or absent block falls back
     * to [DEFAULT_CAPTURE_LAYOUT_DELAY_MS] rather than propagating a throw
     * into a logging call.
     */
    internal fun resolveCaptureLayoutDelayMs(name: String, delay: Double): Int {
        if (delay >= 0) {
            return delay.toInt()
        }
        return try {
            LayoutUtil.getLayoutInfo(name)
                ?.optInt(CAPTURE_LAYOUT_DELAY_KEY, DEFAULT_CAPTURE_LAYOUT_DELAY_MS)
                ?.coerceAtLeast(0)
                ?: DEFAULT_CAPTURE_LAYOUT_DELAY_MS
        } catch (e: Exception) {
            Log.w(TAG, "Could not read $CAPTURE_LAYOUT_DELAY_KEY for \"$name\"; using ${DEFAULT_CAPTURE_LAYOUT_DELAY_MS}ms.", e)
            DEFAULT_CAPTURE_LAYOUT_DELAY_MS
        }
    }

    /**
     * Logs a dialog show event with the specified dialog information.
     *
     * @param dialogId    Unique identifier for the dialog.
     * @param dialogTitle The title of the dialog.
     * @param dialogType  The type of dialog (alert, custom, modal).
     * @return True if the operation was successful, false otherwise.
     */
    override fun logDialogShowEvent(dialogId: String, dialogTitle: String, dialogType: String): Boolean {
        var result: Boolean

        try {
            // Your existing logging code...
            val values = HashMap<String?, String?>()
            values["dialogId"] = dialogId
            values["dialogTitle"] = dialogTitle
            values["dialogType"] = dialogType
            values["eventType"] = "dialog_show"
            values["timestamp"] = System.currentTimeMillis().toString()

            // For Alert dialogs, use delayed capture to ensure dialog is rendered
            if (dialogType == "alert") {
                // Schedule delayed capture to allow dialog to render
                Handler(Looper.getMainLooper()).postDelayed({
                    try {
                        val dialog = findMostRecentDialog()
                        if (dialog != null) {
                            val activity = getCurrentActivity()
                            if (activity != null) {
                                DialogUtil.logDialog(getCurrentActivity(), dialog)
//                                Tealeaf.logScreenLayoutSetOnShowListener(activity, dialog, dialogId, true)
                                Log.v(TAG, "Delayed screenshot capture successful for dialog: $dialogId")
                            }
                        } else {
                            Log.v(TAG, "Warning: Could not find dialog object for $dialogId after delay")
                            // Fallback to regular screen layout capture
                            logAutomaticScreenLayout(Objects.requireNonNull<Activity?>(getCurrentActivity()), dialogTitle, 0)
                        }
                    } catch (e: Exception) {
                        Log.v(TAG, "Error in delayed dialog capture: ${e.message}")
                        // Fallback to regular screen layout capture
                        logAutomaticScreenLayout(Objects.requireNonNull<Activity?>(getCurrentActivity()), dialogTitle, 0)
                    }
                }, DIALOG_CAPTURE_DELAY_MS) // Use configurable delay

                // Return true immediately since we're handling capture asynchronously
                result = true
            } else {
                // For non-alert dialogs, try immediate capture first
                val dialog = findMostRecentDialog()
                if (dialog != null) {
                    val activity = getCurrentActivity()
                    if (activity != null) {
                        DialogUtil.logDialog(getCurrentActivity(), dialog)
                        return true
                    } else {
                        result = false
                    }
                } else {
                    // Default fallback
                    result = logAutomaticScreenLayout(Objects.requireNonNull<Activity?>(getCurrentActivity()), dialogTitle, 300)
                }
            }
        } catch (e: Exception) {
            Log.v(TAG, "Error logging dialog show event: ${e.message}")
            result = false
        }
        return result
    }

    private fun findMostRecentDialog(): Dialog? {
        val activity = getCurrentActivity() ?: return null

        // Check fragments first
        val fragmentDialog = findDialogFromFragments(activity)
        if (fragmentDialog != null) return fragmentDialog

        // Check window manager for Alert dialogs with retry logic
        return findLatestDialogFromWindowManager(activity)
    }

    private fun findDialogFromFragments(activity: Activity): Dialog? {
        try {
            // Check support fragments first (more common in modern apps)
            if (activity is androidx.fragment.app.FragmentActivity) {
                val supportFm = activity.supportFragmentManager
                for (frag in supportFm.fragments) {
                    if (frag is androidx.fragment.app.DialogFragment) {
                        val dialog = frag.dialog
                        if (dialog != null && dialog.isShowing) {
                            return dialog
                        }
                    }
                }
            }

            // Check legacy fragments
            // Note: fm.fragments is only available in API 26+, so we'll skip this for older versions
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val fm = activity.fragmentManager
                if (fm != null) {
                    for (frag in fm.fragments) {
                        if (frag is DialogFragment) {
                            val dialog = frag.dialog
                            if (dialog != null && dialog.isShowing) {
                                return dialog
                            }
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.v(TAG, "Error checking fragments: ${e.message}")
        }
        return null
    }

    private fun findLatestDialogFromWindowManager(activity: Activity): Dialog? {
        try {
            val wmgClass = Class.forName("android.view.WindowManagerGlobal")
            val wmgInstance = wmgClass.getMethod("getInstance").invoke(null)

            val viewsField = wmgClass.getDeclaredField("mViews")
            viewsField.isAccessible = true
            val views = viewsField.get(wmgInstance) as ArrayList<View>

            val paramsField = wmgClass.getDeclaredField("mParams")
            paramsField.isAccessible = true
            val params = paramsField.get(wmgInstance) as ArrayList<WindowManager.LayoutParams>

            // Find the most recent dialog window (last in the list)
            for (i in views.indices.reversed()) {
                val view = views[i]
                val param = params[i]

                if (isDialogWindow(param)) {
                    // Try to get dialog from view context
                    var context = view.context
                    while (context is ContextWrapper) {
                        if (context is Dialog && context.isShowing) {
                            Log.v(TAG, "Found dialog in WindowManager: ${context.javaClass.simpleName}")
                            return context
                        }
                        context = context.baseContext
                    }

                    // Additional check: look for AlertDialog specifically
                    if (view.javaClass.name.contains("AlertController")) {
                        Log.v(TAG, "Found AlertController view, attempting to get dialog")
                        // Try to find the dialog through the view's parent or other means
                        val parent = view.parent
                        if (parent is View) {
                            var parentContext = parent.context
                            while (parentContext is ContextWrapper) {
                                if (parentContext is Dialog && parentContext.isShowing) {
                                    Log.v(TAG, "Found AlertDialog through parent context")
                                    return parentContext
                                }
                                parentContext = parentContext.baseContext
                            }
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.v(TAG, "Error accessing WindowManager: ${e.message}")
        }
        return null
    }

    private fun isDialogWindow(params: WindowManager.LayoutParams): Boolean {
        return params.type == WindowManager.LayoutParams.TYPE_APPLICATION_PANEL ||
                params.type == WindowManager.LayoutParams.TYPE_APPLICATION_SUB_PANEL ||
                (params.flags and WindowManager.LayoutParams.FLAG_DIM_BEHIND) != 0
    }

    /**
     * Logs a dialog dismiss event with the specified dialog information.
     *
     * @param dialogId      Unique identifier for the dialog.
     * @param dismissReason The reason for dismissing the dialog.
     * @return True if the operation was successful, false otherwise.
     */
    override fun logDialogDismissEvent(dialogId: String, dismissReason: String): Boolean {
        var result = false
        try {
            val values = HashMap<String?, String?>()
            values["dialogId"] = dialogId
            values["dismissReason"] = dismissReason
            values["eventType"] = "dialog_dismiss"
            values["timestamp"] = System.currentTimeMillis().toString()

            result =
                Connect.logCustomEvent("DialogDismissEvent", values, EOMonitoringLevel.kEOMonitoringLevelInfo.value)
        } catch (e: Exception) {
            Log.v(TAG, "Error logging dialog dismiss event: ${e.message}")
            result = false
        }
        return result
    }

    /**
     * Logs a dialog button click event with the specified button information.
     *
     * @param dialogId    Unique identifier for the dialog.
     * @param buttonText  The text of the clicked button.
     * @param buttonIndex The index of the clicked button.
     * @return True if the operation was successful, false otherwise.
     */
    override fun logDialogButtonClickEvent(dialogId: String, buttonText: String, buttonIndex: Double): Boolean {
        var result: Boolean

        try {
            val values = HashMap<String?, String?>()
            values["dialogId"] = dialogId
            values["buttonText"] = buttonText
            values["buttonIndex"] = buttonIndex.toInt().toString()
            values["eventType"] = "dialog_button_click"
            values["timestamp"] = System.currentTimeMillis().toString()

            result = Connect.logCustomEvent("DialogButtonClickEvent", values, EOMonitoringLevel.kEOMonitoringLevelInfo.value)

            // TODO:  JS pass button id
            // Simple approach: find the most recently shown dialog
//            val dialog = findMostRecentDialog()
//            if (dialog != null) {
//                val activity = getCurrentActivity()
//                if (activity != null) {
//                    val view = when (dialog) {
//                        is AlertDialog -> dialog.getButton(id)
//                        is androidx.appcompat.app.AlertDialog -> dialog.getButton(id)
//                        else -> null
//                    }
//
//                    if (view == null) {
//                        return false
//                    }
//
//                    Connect.logDialogEvent(dialog, 1)
//                }
//            }
        } catch (e: Exception) {
            Log.v(TAG, "Error logging dialog button click event: ${e.message}")
            result = false
        }
        return result
    }

    /**
     * Logs a custom dialog event with the specified event information.
     *
     * @param dialogId   Unique identifier for the dialog.
     * @param eventName  The name of the custom event.
     * @param values     A map of values associated with the event.
     * @return True if the operation was successful, false otherwise.
     */
    override fun logDialogCustomEvent(
        dialogId: String,
        eventName: String,
        values: Map<String, Variant_Boolean_String_Double>
    ): Boolean {
        var result = false
        try {
            val eventValues = HashMap<String?, String?>()
            eventValues["dialogId"] = dialogId
            eventValues["customEventName"] = eventName
            eventValues["eventType"] = "dialog_custom_event"
            eventValues["timestamp"] = System.currentTimeMillis().toString()

            // Add the custom values
            for (key in values.keys) {
                val value = values[key]
                if (value != null) {
                    eventValues[key] = variantToString(value)
                }
            }

            result =
                Connect.logCustomEvent("DialogCustomEvent", eventValues, EOMonitoringLevel.kEOMonitoringLevelInfo.value)
        } catch (e: Exception) {
            Log.v(TAG, "Error logging dialog custom event: ${e.message}")
            result = false
        }
        return result
    }

    /**
     * Unwraps a Nitro variant to the underlying JS value it carries — a
     * [Boolean], [String], or [Double].
     *
     * The generated `Variant_*` type is a sealed **data** class, so calling
     * `toString()` on the variant itself yields the case wrapper
     * (`"Second(value=pro)"`) instead of the value (`"pro"`). Every conversion
     * that reads a variant must unwrap it first. Mirrors the iOS bridge's
     * `ConnectRNParsing.convertVariantToAny`, keeping emitted payloads
     * identical across platforms.
     *
     * @param value The variant to unwrap.
     * @return The wrapped Boolean, String, or Double.
     */
    private fun unwrapVariant(value: Variant_Boolean_String_Double): Any =
        value.match(first = { it }, second = { it }, third = { it })

    /**
     * Unwraps a Nitro variant (see [unwrapVariant]) and renders it as a string,
     * for the SDK entry points that take `HashMap<String, String>` payloads.
     *
     * Booleans render as `"true"`/`"false"`, strings pass through unchanged,
     * and numbers go through [formatJsNumber] so they read the way the same
     * JS value reads on iOS.
     *
     * @param value The variant to stringify.
     * @return The wrapped value's string form.
     */
    private fun variantToString(value: Variant_Boolean_String_Double): String =
        when (val unwrapped = unwrapVariant(value)) {
            is Double -> formatJsNumber(unwrapped)
            else -> unwrapped.toString()
        }

    /**
     * Renders a JS number the way JS itself — and therefore the iOS bridge —
     * renders it: `2` stays `"2"`, `2.5` stays `"2.5"`.
     *
     * Every JS number crosses Nitro as a [Double], so a JS `2` arrives as
     * `2.0`, and Kotlin's [Double.toString] spells that `"2.0"`. iOS hands the
     * same value to the SDK as a native number, which `NSJSONSerialization`
     * writes as `2`. The result was a cross-platform payload split on any
     * whole number — `"seats": "2.0"` on Android against `"seats": 2` on iOS —
     * which breaks dashboards and Composer rules that compare the two.
     * Dropping the trailing `.0` closes the *textual* half of that gap.
     *
     * It does not close the *type* half on the custom-event path: the SDK's
     * `logCustomEvent` chain is typed `HashMap<String, String>` end to end, so
     * an Android custom-event number is a JSON string (`"2"`) where iOS sends a
     * JSON number (`2`). Only `logSignal` carries native types on Android, and
     * that path deliberately does not come through here — see [toSignalPayload].
     *
     * Integral values are rendered through [Long] only below 2^53, which spans
     * every integer JS itself represents exactly; beyond that the [Double] form
     * is kept rather than inventing digits a `Long` round-trip would imply.
     * Non-finite values keep Kotlin's spelling (`"NaN"`, `"Infinity"`) — there
     * is no JSON representation to match, and stringifying is strictly safer
     * than throwing out of an analytics call.
     *
     * @param value The number to render.
     * @return Its string form, without a trailing `.0` for whole numbers.
     */
    internal fun formatJsNumber(value: Double): String {
        if (!value.isFinite()) {
            return value.toString()
        }
        if (value == Math.floor(value) && Math.abs(value) < 9007199254740992.0) {
            return value.toLong().toString()
        }
        return value.toString()
    }

    /**
     * Converts a map of Variant_Boolean_String_Double to a HashMap<String?, String?>.
     *
     * Values are unwrapped before stringifying (see [variantToString]).
     *
     * @param values The map to be converted.
     * @return A HashMap<String?, String?> representation of the input map which library can use.
     */
    // internal (not private) so the unit tests in src/test can exercise it.
    internal fun convertToMap(values: Map<String, Variant_Boolean_String_Double>): HashMap<String?, String?> {
        val map = HashMap<String?, String?>()
        for (key in values.keys) {
            val value = values[key]
            if (value != null) {
                map[key] = variantToString(value)
            }
        }
        return map
    }

    /**
     * Converts an [AnyMap]-derived map into the payload `Connect.logSignal`
     * expects, rebuilding nested structures as [JSONObject] / [JSONArray].
     *
     * The rebuild is mandatory, not cosmetic. The SDK serializes the signal
     * through EOCore's `JsonUtil.getHashValues`, which walks the top-level
     * entries and accumulates only `String`, `Boolean`, `Number` (from Connect
     * Android 11.0.24-beta), `JSONObject`, `JSONArray` and `ByteArray` —
     * anything else is **silently dropped**. So a nested `Map`/`List` handed
     * over as-is would vanish from the emitted signal without any error.
     * Converting here is what makes nested payloads survive the wire.
     *
     * `null` becomes [JSONObject.NULL] rather than a Kotlin `null`, which
     * `org.json` requires for an explicit JSON `null`.
     *
     * Version boundary — **top-level** numbers. `getHashValues` gained a
     * `Number` branch in Connect Android 11.0.24-beta and accumulates the boxed
     * value as-is, so a top-level number now reaches the wire. On earlier builds
     * its `instanceof` ladder had no such branch, the entry was skipped with no
     * error, and nothing here could rescue it. Numbers nested inside an object
     * or array were never affected — the enclosing [JSONObject]/[JSONArray] is
     * built here, so `org.json` serializes them normally — and iOS has always
     * carried top-level numbers. Both sides of the boundary sit inside the
     * `[11.0.11, 12.0.0)` range this bridge accepts, so an integration pinning
     * an older Connect version still sees the old behaviour; nesting a number
     * is portable across the whole range.
     *
     * A [JSONException] aborts the whole payload rather than escaping to the
     * caller. Non-finite numbers are the case that raises it: `org.json`
     * rejects them, and [toJsonValue] raises them explicitly so a top-level one
     * behaves like a nested one. Either way a JS `Infinity` or `NaN` would
     * otherwise throw straight out of `logSignal` and take the host app's call
     * site down — unacceptable for an analytics SDK, and a behaviour change
     * from the scalar-only bridge, which could not throw. Dropping the whole
     * payload also matches iOS, where a single non-finite value fails
     * `isValidJSONObject:` and the `signal` key is omitted entirely.
     *
     * @param values The map from [AnyMap.toHashMap].
     * @return A HashMap the SDK's signal serializer can consume, or an empty
     *   map if the payload could not be represented as JSON.
     */
    // internal (not private) so the unit tests in src/test can exercise it.
    internal fun toSignalPayload(values: Map<String, Any?>): java.util.HashMap<String?, Any?> {
        val map = HashMap<String?, Any?>(values.size)
        try {
            for ((key, value) in values) {
                map[key] = toJsonValue(value)
            }
        } catch (e: JSONException) {
            Log.w(TAG, "[bridge] logSignal payload is not representable as JSON — dropping it: ${e.message}")
            return HashMap()
        }
        return map
    }

    /**
     * Recursive helper for [toSignalPayload]. Maps Kotlin containers onto their
     * `org.json` equivalents and leaves scalars alone.
     *
     * Nitro's JNI layer converts the whole tree to plain Java types before it
     * reaches Kotlin — a JS object becomes a `HashMap`, a JS array an
     * `ArrayList`, and scalars become `Double` / `Boolean` / `Long` / `String`
     * — so there are no `AnyValue` wrappers left to unwrap here. [List] is
     * therefore the branch a JS array actually takes; [Array] is handled too,
     * to guard against a future Nitro representation change.
     *
     * @param value A value from an [AnyMap]-derived container.
     * @return The `org.json`-compatible equivalent.
     */
    private fun toJsonValue(value: Any?): Any =
        when (value) {
            null -> JSONObject.NULL
            is Map<*, *> -> JSONObject().apply {
                for ((nestedKey, nestedValue) in value) {
                    put(nestedKey.toString(), toJsonValue(nestedValue))
                }
            }
            is Array<*> -> JSONArray().apply {
                for (element in value) put(toJsonValue(element))
            }
            is List<*> -> JSONArray().apply {
                for (element in value) put(toJsonValue(element))
            }
            // Checked here rather than left to `org.json`. A non-finite number
            // nested in an object or array is rejected by that container's
            // `put`, but a TOP-LEVEL one is only ever handed to `HashMap.put`,
            // which accepts anything — so without this the payload would reach
            // the SDK, and what happened there would depend on the resolved
            // Connect version: before 11.0.24-beta it lost just that one key
            // while the nested case lost everything; from 11.0.24-beta the
            // SDK's own `Number` branch rejects it and drops the whole payload.
            // Raising it here keeps the two cases consistent across the
            // supported range and matches iOS, where one non-finite value fails
            // `isValidJSONObject:` for the entire signal.
            is Double -> if (value.isFinite()) {
                value
            } else {
                throw JSONException("non-finite number: $value")
            }
            else -> value
        }

    /**
     * Gets the current activity from the ReactApplicationContext.
     *
     * @return The current activity or null if not available.
     */
    private fun getCurrentActivity(): android.app.Activity? {
        return applicationContext?.currentActivity
    }

    /**
     * Add focus listener to handle EditText UI control.
     *
     * @param textView        Input TextView.
     * @param accessibilityID Accessibility ID(virtual id).
     * @param activity        Current activity.
     */
    fun addFocusAndRegister(textView: TextView, accessibilityID: String?, activity: Activity) {
        textView.onFocusChangeListener = OnFocusChangeListener { v: View, hasFocus: Boolean ->
            if (hasFocus) {
                val imm = v.context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
                imm.showSoftInput(v, InputMethodManager.SHOW_FORCED)
                val keyboardView = KeyboardView(v.context.applicationContext, null)

                if (TextUtils.isEmpty(accessibilityID)) {
                    logEvent(keyboardView, TLF_UI_KEYBOARD_DID_SHOW_NOTIFICATION)
                    logEvent(v, TLF_ON_FOCUS_CHANGE_IN)
                } else {
                    logEvent(keyboardView, TLF_UI_KEYBOARD_DID_SHOW_NOTIFICATION, accessibilityID!!)
                    logEvent(v, TLF_ON_FOCUS_CHANGE_IN, accessibilityID!!)
                }
            } else {
                logEvent(v, TLF_ON_FOCUS_CHANGE_OUT)
                val imm = v.context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
                imm.hideSoftInputFromWindow(v.windowToken, 0)

                val keyboardView = KeyboardView(v.context.applicationContext, null)

                if (TextUtils.isEmpty(accessibilityID)) {
                    logEvent(keyboardView, TLF_UI_KEYBOARD_DID_HIDE_NOTIFICATION)
                } else {
                    logEvent(keyboardView, TLF_UI_KEYBOARD_DID_HIDE_NOTIFICATION, accessibilityID!!)
                }
            }
        }

        registerFormField(textView, activity)
    }

//  override fun onWindowFocusChanged(hasFocus: Boolean) {
//    if (!reactContext.hasActiveCatalystInstance()) {
//      logEvent("WindowFocus", "Context is not ready. Skipping onWindowFocusChanged.")
//      return
//    }
//
//    // Handle window focus change
//    if (hasFocus) {
//      logEvent("WindowFocus", "Window gained focus")
//    } else {
//      logEvent("WindowFocus", "Window lost focus")
//    }
//  }

//  override fun onWindowFocusChanged(hasFocus: Boolean) {
//    super.onWindowFocusChanged(hasFocus)
//
//    val reactHost = (application as MainApplication).reactHost
//    if (reactHost != null) {
//      reactHost.onWindowFocusChange(hasFocus)
//    }
//  }

    fun onWindowFocusChanged(hasFocus: Boolean) {
        if (applicationContext == null) {
//      logEvent("WindowFocus", "Context is not ready. Skipping onWindowFocusChanged.")
            return
        }

        // Handle window focus change
        if (hasFocus) {
//      logEvent("WindowFocus", "Window gained focus")
        } else {
//      logEvent("WindowFocus", "Window lost focus")
        }
    }

    /**
     * Used when host resumes.
     */
    override fun onHostResume() {
        // Initialize Connect library, and hook into activity lifecycle events to help detect if app is in background
        if (applicationContext == null) {
//      logEvent("Lifecycle", "onHostResume skipped: ReactContext is not ready")
            return
        }

        val activity = getCurrentActivity()
        if (activity == null) {
//      logEvent("Lifecycle", "onHostResume skipped: Activity is null")
            return
        }

        if (!isEnabled()) {
            if (getApplication() == null) {
                val app = resolveApplication() ?: return
                init(app)
            }
            // Qualified to bypass the `enable()` override on this class —
            // call the native SDK's `Connect.enable()` directly so the
            // log line "called from JS" doesn't fire on lifecycle wake-ups.
            Connect.enable()
            resolveApplication()?.let { maybeEnablePushOnMain(it) }
        }
        onResume(activity, null)
    }

    /**
     * Used when host gets paused.
     */
    override fun onHostPause() {
        val activity = getCurrentActivity()
        if (activity == null) {
//      logEvent("Lifecycle", "onHostPause skipped: Activity is null")
            return
        }

        Connect.onPause(activity, null)
    }

    /**
     * Used when host gets destroyed.
     */
    override fun onHostDestroy() {
        val activity = getCurrentActivity()
        if (activity == null) {
//      logEvent("Lifecycle", "onHostDestroy skipped: Activity is null")
            return
        }

        Tealeaf.onDestroy(activity, null)
        // Uncomment if Connect.onDestroy is needed
        // Connect.onDestroy(activity, null)
    }

    companion object {
        const val TAG = "AcousticConnectRN"
        const val DIALOG_CAPTURE_DELAY_MS = 500L // Configurable delay for dialog screenshot capture

        /** Key holding the per-screen capture delay, in milliseconds, inside a layout-config rule. */
        const val CAPTURE_LAYOUT_DELAY_KEY = "CaptureLayoutDelay"

        /**
         * Delay applied when the layout config names none. Matches the value the
         * Connect SDK ships in its own `TealeafLayoutConfig.json`.
         */
        const val DEFAULT_CAPTURE_LAYOUT_DELAY_MS = 500

        // Class probed at runtime to detect whether the connect-push-fcm
        // transport artifact was included in the build (i.e. automatic mode,
        // where Connect's own FirebaseMessagingService is the PushReceived
        // sink). Points at the FCM messaging service shipped
        // by the connect-push-fcm artifact.
        private const val CONNECT_PUSH_FCM_PROBE_CLASS =
            "com.acoustic.connect.android.connectmod.push.services.fcm.FCMPushService"

        /**
         * Default `additionalParameters` for an identity signal, matched to the
         * signal type the bridge will actually send.
         *
         * Connect's signal schema requires a *method* attribute on identity
         * signals, and the required key differs per type: `loggedIn` requires
         * `loginMethod`, `accountRegistered` requires `registrationMethod`.
         * Supplying the wrong one fails schema validation and the signal is
         * discarded, while [Connect.logIdentificationEvent] still reports
         * success — so the caller sees nothing wrong. Before this mapping
         * existed the bridge paired its `loggedIn` default with
         * `registrationMethod`, which meant every defaulted identity call was
         * silently dropped.
         *
         * Only consulted when the caller omits `additionalParameters`
         * entirely; an explicitly-provided map is passed through untouched.
         */
        internal fun defaultIdentityParameters(signalType: String): Map<String, String> =
            when (signalType) {
                "loggedIn" -> mapOf("loginMethod" to "email")
                else -> mapOf("registrationMethod" to "email")
            }
    }
}
