# Connect Bare Workflow Demo

A React Native 0.82 **bare workflow** sample app for the
`react-native-acoustic-connect-beta` SDK. Two audiences:

1. **Customer / support reference** — minimal, polished demo you can
   clone, point at your collector, and have screen views + click events
   flowing in minutes.
2. **Verification surface** — proves the v19.x SDK installs and
   initialises in a fresh RN 0.82 project (no Expo).

The UI mirrors the iOS native sample app at
[`Acoustic-Connect-Mobile-Push-Sample-App`](https://github.com/aipoweredmarketer/Acoustic-Connect-Mobile-Push-Sample-App)
so the two demos look the same side-by-side.

## Scope

| Tab                | Status            | What it does                                                                              |
| ------------------ | ----------------- | ----------------------------------------------------------------------------------------- |
| **Push**           | Implemented       | Notification authorization status + Request Authorization button (via `pushGetPermissionState` / `pushRequestPermission`). |
| **Identity**       | Implemented       | Logs `loggedIn` / `accountRegistered` signals with identifier name + value. Recents list. |
| **Behaviour**      | Empty placeholder | Reserved for the analytics half of the SDK — custom events, signals, clicks, screen views. |

This sample exercises the full v19.x push surface on iOS (APNs) and Android
(FCM) — manual-mode lifecycle forwarding, NSE + NCE rich-media targets,
cross-platform permission methods, and the config-driven push mode. See
[Mobile Push Setup](#mobile-push-setup).

Out of scope for this sample:

- Expo config plugin verification (covered by the Expo sibling story).
- iOS-only 5-state `getDetailedPermissionState()` (not in v19.x).

## Prerequisites

- **Node** ≥ 20
- **iOS**: Xcode 26, iOS 15.1+ simulator, CocoaPods (via Bundler)
- **Android**: Android Studio with API 35 SDK, JDK 17, Android NDK,
  Gradle 9.x (bundled), minSdk 26; `adb` on your PATH
  (`$ANDROID_HOME/platform-tools`)
- **For mobile push**:
  - iOS: an Apple Developer **Team ID** set as `Connect.iOSDevelopmentTeam`
    in `ConnectConfig.json` (required even on the Simulator — without it the
    build embeds no `aps-environment` and no APNs token is issued), a Push
    Notifications-enabled App ID, and an APNs key/cert on your Acoustic
    channel. Modern Simulators
    (Xcode 14+/Apple Silicon) **do** register and receive remote pushes — only
    the collapsed-banner rich-media **thumbnail** needs a physical device to
    verify.
  - Android: a **Google Play** emulator or device (a plain AOSP AVD cannot
    receive FCM) plus a Firebase project whose `google-services.json` package
    name matches the app's `applicationId`. The backend's FCM credentials must
    belong to that **same** Firebase project or pushes won't deliver.

## Setup

**Quick start — one command.** The bootstrap is a "doctor + full auto": it checks
prerequisites, scaffolds any missing per-developer config from the committed
templates, validates it, and installs dependencies. It's idempotent (safe to
re-run) and never ships real credentials.

```bash
cd Examples/bare-workflow
npm run bootstrap            # or: npm run bootstrap:ios / npm run bootstrap:android
```

Then fill in the per-developer files the bootstrap flags:

- `ConnectConfig.json` — your AppKey + collector URLs, and (for iOS push)
  `Connect.iOSDevelopmentTeam` (your 10-char Apple Team ID) +
  `Connect.iOSAppGroupIdentifier`
- Android: `android/app/google-services.json` — the real file from Firebase

<details>
<summary>Manual equivalent (what bootstrap automates)</summary>

```bash
cd Examples/bare-workflow

# 1. Install JS deps (run at the repo root in a workspace checkout)
npm install

# 2. iOS — pods
bundle install                                  # one-time per machine
bundle exec pod install --project-directory=ios

# 3. Configure your Connect credentials (gitignored)
cp ConnectConfig.example.json ConnectConfig.json
$EDITOR ConnectConfig.json

# 4. iOS push: set your signing team in ConnectConfig.json, then wire the
#    extensions. setup-ios-push stamps DEVELOPMENT_TEAM (from
#    Connect.iOSDevelopmentTeam) onto the host app + both extensions.
$EDITOR ConnectConfig.json                    # set Connect.iOSDevelopmentTeam
npx acoustic-connect setup-ios-push

# 5. Android push: drop in your real google-services.json (gitignored)
cp android/app/google-services.json.template android/app/google-services.json
$EDITOR android/app/google-services.json      # replace with the Firebase file
```

</details>

## Run

```bash
# Terminal 1 — Metro
npm run start

# Terminal 2 — iOS Simulator
npm run ios

# Or Android Emulator
npm run android
```

## Build

Produce a signed **debug APK** — used by CI / test automation and for
sideloading onto partner devices:

```bash
cd Examples/bare-workflow/android
./gradlew :app:assembleDebug      # JDK 17; Gradle 9 via the bundled wrapper
# → android/app/build/outputs/apk/debug/app-debug.apk
```

The debug keystore (`android/app/debug.keystore`, all passwords `android`)
is committed, so a fresh checkout builds and signs without extra setup. The
`release` build type signs with the same keystore for demo convenience —
**production apps must generate their own**
([signed APK guide](https://reactnative.dev/docs/signed-apk-android)).

> **Build standalone.** Build from a clean clone or copy of this sample, not
> nested inside another package's `node_modules` tree — otherwise npm hoists
> the sample's React Native version and the Android build resolves the wrong
> one.

## Configuring SDK Credentials

The demo reads credentials from `ConnectConfig.json` next to this README.
The SDK's `applyConfiguration` step propagates them at install time into
the native projects:

- **iOS**: `ios/AcousticConnectRNConfig.json` is populated during
  `pod install`.
- **Android**: `android/src/main/assets/ConnectBasicConfig.properties`
  is populated by `config.gradle` during the Gradle build.

`App.tsx` then calls `AcousticConnectRN.enable()` — a zero-arg
idempotent kick. The native bridge auto-initialises the SDK on cold
start from the bundled config; the JS call is just confirmation.

To change credentials: edit `ConnectConfig.json`, re-run
`bundle exec pod install --project-directory=ios` for iOS, then
relaunch.

## Mobile Push Setup

Push is configured entirely in `ConnectConfig.json` (no runtime arguments —
`enable()` is parameterless as of v19.x). The relevant fields:

```jsonc
{
  "Connect": {
    "PushEnabled": true,                 // master gate (both platforms)
    "iOSPushMode": "automatic",          // "automatic" | "manual"
    "iOSAppGroupIdentifier": "group.<your.bundle.id>",
    "AndroidNotificationIconResName": "ic_stat_push"
  }
}
```

- **Push mode is fixed at install time.** `iOSPushMode` is baked into the
  bundled config by `pod install` (iOS) / Gradle config (Android). Switching
  modes means editing `ConnectConfig.json` and re-running `pod install` /
  re-syncing Gradle (there is no runtime mode toggle).
- **automatic** (this demo's default) — the SDK manages the full APNs/FCM
  lifecycle itself: it swizzles the app delegate for token capture and installs
  a `UNUserNotificationCenter` delegate proxy (iOS) / registers its own FCM
  service (Android). The host AppDelegate wiring still present is harmless —
  the SDK's proxy wraps it and the manual-only forwarders no-op
  (`EAC-RN-007`).
- **manual** — the host app owns the delegate and forwards each lifecycle
  event to the SDK itself (see `ios/.../AppDelegate.swift`).

### iOS — APNs + NSE/NCE targets

1. **App Group + Push capability.** The host app and both extensions share
   the App Group in `iOSAppGroupIdentifier`. The entitlements are committed
   (`ios/ConnectBareWorkflowDemo/*.entitlements`, `ios/ConnectNSE`,
   `ios/ConnectNCE`); in Xcode, select your Team and confirm the App Group +
   Push Notifications capabilities on all three targets for device builds.
1. **Code-signing team (required for APNs registration).** The
   `aps-environment` entitlement is only embedded when the app builds with an
   Apple Developer Team. Running from Xcode injects your team automatically, so
   push works from the GUI. **Command-line builds (`npm run ios`, `xcodebuild`,
   CI) do not auto-pick a team** — without it the OS returns no APNs token, and
   on the Simulator it fails *silently* (a session reaches the collector but no
   `mobileToken`/PushRegistration). To enable push from the CLI, set your team
   once in `ConnectConfig.json` and re-run the push wiring:

   ```bash
   # ConnectConfig.json → "Connect": { "iOSDevelopmentTeam": "<10-char Team ID>" }
   npx acoustic-connect setup-ios-push
   ```

   `Connect.iOSDevelopmentTeam` is the single source of truth for the signing
   team — `setup-ios-push` stamps `DEVELOPMENT_TEAM` onto the host app and both
   extensions. A free personal team is enough for Simulator registration.

   > ⚠️ This stamps your Team ID into the **committed** `project.pbxproj`, so
   > `git status` will show it modified after bootstrap. The committed sample is
   > team-free on purpose — **do not commit your personal Team ID.** To keep the
   > file clean, either revert it before staging:
   >
   > ```bash
   > git checkout -- ios/ConnectBareWorkflowDemo.xcodeproj/project.pbxproj
   > ```
   >
   > or tell git to ignore your local edits for the session:
   >
   > ```bash
   > git update-index --skip-worktree ios/ConnectBareWorkflowDemo.xcodeproj/project.pbxproj
   > ```
2. **NSE + NCE Xcode targets** are already wired into the project. They were
   added by the SDK's setup command (re-run only if you regenerate the
   Xcode project from a fresh RN template):

   ```bash
   npx acoustic-connect setup-ios-push
   bundle exec pod install --project-directory=ios
   ```

   - `ConnectNSE/NotificationService.swift` subclasses
     `ConnectNotificationService` — downloads the rich-media attachment and
     logs PushReceived via the App Group pending store.
   - `ConnectNCE/NotificationViewController.swift` subclasses
     `ConnectNotificationContentExtension` — renders the rich expansion UI.

   This is the **manual** equivalent of what the Expo Config Plugin produces
   automatically for Expo projects.
3. **AppDelegate** registers for remote notifications and forwards
   `didRegisterForRemoteNotificationsWithDeviceToken` →
   `ConnectSDK.shared.push.didRegisterWithToken`, plus the
   `UNUserNotificationCenter` delegate callbacks → `didReceiveNotification` /
   `didReceive(_:)`. (JS apps that obtain the token in JavaScript would call
   `AcousticConnectRN.pushDidRegisterWithToken(buffer)` instead.)

### Android — FCM

1. Create a Firebase project, add an Android app whose package name matches
   the `applicationId` in `android/app/build.gradle`, and download its
   `google-services.json`.
2. Copy it next to `android/app/google-services.json.template`:

   ```bash
   cp android/app/google-services.json.template android/app/google-services.json
   # then overwrite with the file from the Firebase console
   ```

   The file is gitignored. `android/app/build.gradle` applies the
   `google-services` plugin only when it is present, so the demo still builds
   without it (push just won't deliver).
3. `PushEnabled: true` makes `android/build.gradle` pull the
   `connect-push-fcm` SDK artifact; the SDK registers its FCM service and
   uses `ic_stat_push` (`AndroidNotificationIconResName`) as the status-bar
   icon. Grant the `POST_NOTIFICATIONS` runtime permission via the **Push**
   tab's *Request permission* button on Android 13+.

## Sending a Test Push

End-to-end delivery requires a **physical device** (no APNs token on the iOS
simulator; FCM needs a real `google-services.json`).

1. Build & run on the device; confirm registration:
   - iOS: AppDelegate forwards the APNs token; a PushRegistration (msg 22)
     signal appears at the Collector.
   - Android: the FCM token is registered automatically; PushRegistration
     appears at the Collector.
2. Send from your Acoustic channel (or the APNs/FCM console for a raw test):
   - **Standard push** — title + body. Tapping it fires PushAction (msg 23);
     the SDK runs the built-in action.
   - **Rich (media) push, iOS** — include an `expandedImage` (or the
     `ACOUSTIC_RICH_NOTIFICATION` category). The NSE downloads and attaches
     the media; long-press / expand to see the NCE render it.
3. Foreground vs background: the SDK logs PushReceived (msg 25) on delivery;
   verify all three signals (22 / 25 / 23) at the Collector.

> **Delivery is handled natively.** The v19.x surface has no native→JS push
> listener — inbound notifications are received by the native delegate
> (AppDelegate / FCM service) and forwarded to the SDK there (manual mode),
> or handled entirely by the SDK (automatic mode). There is no JS screen that
> renders received payloads; verify delivery via the on-device banner and the
> signals at the Collector.

## Verifying Events Reach the Collector

### Android — foreground timer-driven

`EOCore` posts on a timer in the foreground. Within ~30s of launch you
should see in logcat:

```
EOCore: Http status: 200 from url:
        https://<your-collector>/collector/collectorPost
```

Tabs, button taps, and text edits keep adding to the queue and posting
on the next tick.

### iOS — lifecycle-driven

The iOS Connect SDK does **not** post in the foreground — it batches
events in memory and flushes on lifecycle transitions. To see events in
the backend:

1. Launch the app and use it (switch tabs, tap buttons).
2. **Send the app to background** — Device → Home or `Cmd + Shift + H`
   in the simulator.
3. Wait ~5–10 s for the `TLFPostInBackground` task to complete.
   Don't immediately re-foreground — that cancels the in-flight post.
4. Refresh the backend; the session and its events appear.

With SDK debug logging on, you'll see:

```
Tealeaf - NSURLSession: In Tealeaf upload task completion block handler.
Response = NSHTTPURLResponse { Status Code: 200 } …/collector/collectorPost
```

To turn on SDK debug logging in the simulator (optional):

```bash
xcrun simctl spawn booted launchctl setenv CONNECT_DEBUG 1
xcrun simctl spawn booted launchctl setenv TLF_DEBUG 1
```

## Troubleshooting

First question for any push problem: **is registration failing, or is
delivery failing?** They look identical from the app but have different fixes.

- **Registration** — the device gets a token and the SDK posts a
  `pushRegistration` (**message type 22**, with `mobileToken` and `mobileProvider`
  `APN`/`FCM`) to the Collector. Confirm this in the logs first.
- **Delivery** — the backend sends and the device receives. If registration works
  but nothing arrives, the problem is backend targeting/credentials, not the app.

For the full diagnostic playbook (log capture, crash triage, isolation tests), use
the **`run-demo-push`** skill (`.claude/skills/run-demo-push/`), and run
`npx acoustic-connect doctor` before building to validate your push config.

### Android (FCM)

| Symptom | Cause | Fix |
| --- | --- | --- |
| `processDebugGoogleServices FAILED … No matching client` | `google-services.json` has no client for the app's `applicationId` | Register that exact `applicationId` in the same Firebase project, download a fresh `google-services.json` (copy from the template first). `npm run bootstrap` flags the mismatch |
| `connect-push-fcm on classpath: false` | `firebase-messaging` not bundled | Firebase BoM in `android/build.gradle` (fixed); if it recurs, the BoM/gating is the cause |
| `sendToken called but PushService is not initialized` | Push transport not bootstrapped | `Connect.push.enable(...)` at init in `HybridAcousticConnectRN.kt` (fixed) |
| Token registers (msg 22) but **no notification** | Backend FCM creds not in the device's Firebase project | Firebase console → Send test message to the token to isolate device-receive vs backend-send |
| `POST_NOTIFICATIONS granted=false` (API 33+) | Runtime permission | Tap *Request Authorization* on the Push tab, or `adb shell pm grant <pkg> android.permission.POST_NOTIFICATIONS` |
| Stale token after update-install | `onNewToken` only fires on a fresh install | Fully uninstall for a clean token test |
| Emulator never gets FCM | Non-Play system image | Use a **Google Play** AVD (`gms` + `vending` present) |
| `adb: command not found` | PATH | Add `$ANDROID_HOME/platform-tools` to PATH |

### iOS (APNs)

| Symptom | Cause | Fix |
| --- | --- | --- |
| `npm run ios` builds but **no APNs token** | CLI builds don't auto-pick a signing team → no `aps-environment` | Set `Connect.iOSDevelopmentTeam` in `ConnectConfig.json`, then `npx acoustic-connect setup-ios-push` (bootstrap does this) to stamp `DEVELOPMENT_TEAM` on host + extensions |
| **Launch crash** `EXC_BREAKPOINT` in `ConnectNotificationCenterProxy` | Host set the `UNUserNotificationCenter` delegate in automatic mode | Don't set the delegate in automatic mode (already gated in `AppDelegate.swift`) |
| **No rich image / NCE crash** ("Unable to find NSExtensionContextClass") | NCE didn't link `UserNotificationsUI.framework` | `npx acoustic-connect setup-ios-push` then `pod install` (bootstrap does this) |
| **Collapsed thumbnail missing on Simulator** | Simulator doesn't render collapsed attachment thumbnails (it *does* receive push + render the expanded view) | Verify the thumbnail on a **physical device** |
| `pod install` can't resolve `AcousticConnectDebug 2.x` | On git Specs before CDN | git Specs `source` in Podfile; run `pod repo update` |
| Xcode 26 consteval `fmt` compile error | Apple-clang guard | `fmt` patch in Podfile `post_install` — ensure `pod install` ran |
| `INSTALL_FAILED…` / signature mismatch | Stale install, different identity | Uninstall the app, reinstall |
| `simctl push` shows no rich media | `simctl` doesn't run the NSE | Use a real APNs (backend) push |

### Build-generated config files

After any build, `android/src/main/assets/*Config*` and
`ios/AcousticConnectRNConfig.json` show as modified — they're rewritten per-consumer
from `ConnectConfig.json` at build time. **Don't commit them**
(`git checkout -- <path>` to discard).

## Architecture

```
App.tsx
  └─ ConnectSDKManager.start()           (zero-arg enable, hydrates state)
  └─ Connect (SDK wrapper)               (screen + click capture)
       └─ NavigationContainer
            └─ BottomTabs:
                 ├─ Push      → src/screens/PushScreen.tsx
                 ├─ Identity  → src/screens/IdentityScreen.tsx
                 └─ Behaviour → src/screens/BehaviourScreen.tsx
```

- **`<Connect>` from the SDK** is the canonical RN integration. It
  subscribes to `NavigationContainer`'s `state` event to log screen
  views, and wraps its children with
  `onStartShouldSetResponderCapture` so every touch reaches
  `TLTRN.logClickEvent`. Without this wrapper only the native side's
  initial-screen-layout auto-instrumentation reaches the collector.
- **`ConnectSDKManager` (singleton)** wraps the SDK and exposes
  observable state via a `subscribe()` pub-sub. Mirrors the iOS sample's
  `ConnectSDKManager` `ObservableObject`. Components consume it through
  the `useManagerState()` hook (`useSyncExternalStore` under the hood).
- **Theme tokens** at `src/theme/colors.ts` mirror the iOS Asset Catalog
  1:1.
- **Components** — `DemoCard`, `DemoTextField`, `StatusRow`, button
  styles are direct RN ports of the iOS counterparts.
- **Push permission helper** — `src/services/pushPermission.ts` wraps the
  cross-platform bridge methods (`pushRequestPermission`,
  `pushGetPermissionState`) as a tri-state (`true` / `false` / `null`). The
  bridge dispatches the platform-appropriate native call internally — no
  `Platform.OS` branching. Push mode, app group, and rich-media targets are
  configured in `ConnectConfig.json` / the native projects (see Mobile Push
  Setup), not in JS.

## Adding a New Demo Card

Drop a new card into any screen:

```tsx
import { DemoCard } from '../components/DemoCard'
import { PrimaryButton } from '../components/buttons'
import AcousticConnectRN from 'react-native-acoustic-connect-beta'

<DemoCard title="Custom Event">
  <PrimaryButton
    title="Fire"
    onPress={() => AcousticConnectRN.logCustomEvent(
      'demoEvent',
      { source: 'bare-workflow' },
      1,
    )}
  />
</DemoCard>
```

This is the recommended pattern for the **Behaviour** tab — intentionally
empty for now so the next pass can populate it with demos for
`logSignal`, `logClickEvent`, `logScreenViewContextLoad`,
`logExceptionEvent`, and friends.
