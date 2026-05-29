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

| Tab           | Status            | What it does                                                                              |
| ------------- | ----------------- | ----------------------------------------------------------------------------------------- |
| **Push**      | Implemented       | Shows OS notification authorization status + Request Authorization button.                |
| **Identity** | Implemented       | Logs `loggedIn` / `accountRegistered` signals with identifier name + value. Recents list. |
| **Behaviour** | Empty placeholder | Reserved for the analytics half of the SDK — custom events, signals, clicks, screen views. |

Out of scope for this sample:

- APNs / FCM token registration, rich push, push tap handling.
- Expo config plugin verification.

## Prerequisites

- **Node** ≥ 20
- **iOS**: Xcode 26, iOS 15.1+ simulator, CocoaPods
- **Android**: Android Studio with API 35 SDK, JDK 17+, Android NDK,
  Gradle 9.x (bundled), minSdk 26

## Setup

```bash
cd Examples/bare-workflow

# 1. Install JS deps
npm install

# 2. iOS — pods
bundle install                                  # one-time per machine
bundle exec pod install --project-directory=ios

# 3. Configure your Connect credentials (gitignored)
cp ConnectConfig.example.json ConnectConfig.json
$EDITOR ConnectConfig.json
```

## Run

```bash
# Terminal 1 — Metro
npm run start

# Terminal 2 — iOS Simulator
npm run ios

# Or Android Emulator
npm run android
```

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
- **Push permission helper** — `src/services/pushPermission.ts` uses
  `PermissionsAndroid` on Android 13+. iOS returns `notDetermined`
  until the dedicated bridge call (`pushRequestPermission()`) ships in
  a future SDK release.

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
