# Android Troubleshooting — bare-workflow push (FCM)

Symptom → cause → fix, plus the diagnostic commands used to root-cause each. All
paths are relative to `Examples/bare-workflow/`. The two SDK-side defects below
were fixed previously; they're documented so a recurrence is quick to place.

## Quick reference

| Symptom | Cause | Fix |
|---|---|---|
| `:app:processDebugGoogleServices FAILED … No matching client found for package name '…'` | `google-services.json` has no `client` whose `package_name` equals the app's `applicationId` | Register **that exact** `applicationId` in the same Firebase project and download a fresh `google-services.json` (copy from `google-services.json.template` first; it's gitignored). The bootstrap flags this mismatch with the exact package |
| `AcousticConnectRN: [config] connect-push-fcm on classpath: false` | `firebase-messaging` not bundled — `connect-push-fcm`'s POM omits it | Firebase BoM + `firebase-messaging` in `android/build.gradle` (fixed, gated by `acousticPushEnabled`). If it recurs, the BoM/gating is the cause |
| `ConnectPush: sendToken called but PushService is not initialized — skipping` | The push transport was never bootstrapped (the AARs declare no ContentProvider/Startup initializer, so nothing self-bootstraps it) | `Connect.push.enable(...)` is called after `Connect.enable()` at all init sites in `HybridAcousticConnectRN.kt` (fixed). If it recurs, that call isn't running |
| Token registers (msg 22 with `mobileToken` reaches the collector) but **no notification arrives** | Delivery/backend, not the app: the backend's FCM credentials must belong to the **same Firebase project (sender id)** as the device's `google-services.json` | Isolate with Firebase console → Cloud Messaging → **Send test message** to the device token. Arrives ⇒ device/app fine, fix backend FCM creds/targeting. Doesn't arrive ⇒ device-receive problem |
| No push at all, **no `onMessageReceived`** in logcat | Message never reached the device (delivery) — distinct from a render/channel issue (the SDK creates its channel lazily on first render) | Use a Google Play AVD; confirm project/sender match; run the Firebase test-message isolation |
| `POST_NOTIFICATIONS: granted=false` (Android 13+) | Runtime notification permission not granted | Tap **Request Authorization** on the Push tab, or `adb shell pm grant <pkg> android.permission.POST_NOTIFICATIONS` |
| Stale token on an update-install | `FCMPushService.onNewToken` only fires on a **fresh** install; update-installs reuse the token | Fully uninstall before a clean token test |
| Emulator never gets/receives FCM | Non-Play system image | Use a **Google Play** AVD (`adb shell pm list packages` lists `com.google.android.gms` + `com.android.vending`) |
| `adb: command not found` | `platform-tools` not on PATH | Add `$ANDROID_HOME/platform-tools` (macOS: `$HOME/Library/Android/sdk/platform-tools`) |
| Spurious modified files after a build | `android/src/main/assets/*Config*` are rewritten per-consumer from `ConnectConfig.json` at build time | Never commit them; `git checkout -- android/src/main/assets` to discard |

## Diagnostic commands

### logcat filters

```bash
# Registration + transport init + delivery, in one view:
adb logcat | grep -E \
  'connect-push-fcm on classpath|PushService is not initialized|Create token registration event|collectorPost|Http status: 200|FCMPushService|onMessageReceived|RemoteMessage|NotificationRender'
```

The PushRegistration shows as an EOCore queue add:
`EOCore … Added to queue:{… "type":22, "pushRegistration":{ "mobileProvider":"FCM","mobileToken":… }}`.
Registration working ≠ delivery working — separate the two.

### Isolation: device-receive vs backend-send

Firebase console → **Cloud Messaging → Send test message** → paste the device's
FCM token. **Arrives** ⇒ the device and app are fine; fix the backend's FCM
credentials/targeting (must be the same Firebase project). **Doesn't arrive** ⇒
emulator/receive problem (use a Google Play AVD).

### Permission + Play-services checks

```bash
adb shell dumpsys package <pkg> | grep POST_NOTIFICATIONS
adb shell pm list packages | grep -E 'com.google.android.gms|com.android.vending'
```

### Confirm which classes are actually bundled (advanced)

When push classes fail to link, decompile the resolved AARs / inspect the installed
APK's dex: a healthy build references `com/google/firebase/messaging/*` **and**
`firebase/installations`. Only ~3 messaging references and zero installations
classes ⇒ `firebase-messaging` is absent (the BoM gating regressed).

## google-services.json ↔ applicationId

The FCM client package **must equal** the `applicationId` in
`android/app/build.gradle`
(`co.acoustic.mobile.connect.new.rn.demo.external.ConnectBareWorkflowDemo`). Note the
gradle `namespace` (`co.acoustic.connect.demo.barewf`) intentionally differs — it
can't equal the applicationId because a path segment is a Java keyword. Register the
**applicationId** in Firebase, not the namespace. `npm run bootstrap` parses both and
fails with the exact fix message on a mismatch.
