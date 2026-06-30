# react-native-acoustic-connect

React Native plugin for the Acoustic Connect SDK. Captures user interactions,
screen replays, and analytics events on iOS and Android. Supports optional push
notifications via the Connect backend.

For the full product overview see the
[Connect SDK overview on the developer portal](https://developer.goacoustic.com/acoustic-connect/docs/connect-sdk-overview).

## Requirements

- React Native 0.82.x – 0.85.x with the new architecture
- React 19.1.1 or newer (or whatever your RN version pins)
- `react-native-nitro-modules` at the **exact** version this package pins in `peerDependencies` (currently **`0.35.9`**) — your app must resolve exactly this version; see [Nitro version pin](#nitro-version-pin)
- Node 20 or newer
- iOS deployment target ≥ 15.1, AcousticConnect / AcousticConnectDebug pod ≥ 2.0.5
- Android `minSdk` ≥ 26, `compileSdk` ≥ 35, `io.github.go-acoustic:connect` in `[11.0.11, 12.0.0)`
- **Expo SDK 55+ is supported** via the bundled Expo Config Plugin —
  development builds only (Expo Go is not supported); see
  [Using with Expo SDK 55+](#using-with-expo-sdk-55).

### Nitro version pin

This package pins `react-native-nitro-modules` to an **exact version**
(currently **`0.35.9`**) in its `peerDependencies` — deliberately *not* a range.
**Your app must resolve exactly that version.**

**Why (important): Nitro patch releases can contain breaking changes.** The SDK
ships native bindings generated against one specific Nitro version, and Nitro's
generated-code ↔ runtime contract is **not patch-safe**. For example, a
`0.35.4` → `0.35.9` *patch* bump changed Nitro's native registration and caused
this SDK's HybridObject to fail to load with a `ClassNotFoundException`, taking
the entire module offline at runtime. Because even a patch can break it, a
version *range* (`^`/`~`/`>=…<…`) cannot guarantee compatibility — so the pin is
exact.

If your app resolves a different Nitro version, the SDK may fail to start. You
*can* force past the peer check with `--legacy-peer-deps` / `--force`, **but
then you own making it work** — we cannot guard against breaking changes in
arbitrary future Nitro patch releases. When this SDK adopts a newer Nitro, it
ships in a new SDK release with the pin bumped; upgrade the SDK and Nitro
together.

## Installation

```bash
npm install react-native-acoustic-connect react-native-nitro-modules
cd ios && pod install
```

The plugin reads a `ConnectConfig.json` from your project root at install time
(iOS via the podspec, Android via `config.gradle`) and bakes the values into the
native bundles. **`ConnectConfig.json` is the single source of truth** — there
is no runtime override path. A minimal config looks like:

```json
{
  "Connect": {
    "AppKey": "your-app-key",
    "PostMessageUrl": "https://collector.example.com/collectorPost",
    "KillSwitchUrl": "https://collector.example.com/collector/switch/your-app-key",
    "useRelease": false,

    "PushEnabled": false,
    "iOSPushMode": "automatic",
    "iOSAppGroupIdentifier": null,
    "AndroidNotificationIconResName": null
  }
}
```

Field summary (see [API reference](#api-reference) for full semantics):

| Field | Default | Purpose |
| --- | --- | --- |
| `AppKey` | _(required)_ | Your Connect application key. |
| `PostMessageUrl` | _(required)_ | Collector endpoint URL. |
| `KillSwitchUrl` | _(optional)_ | Kill-switch endpoint URL. |
| `useRelease` | `false` | `true` selects the release AcousticConnect iOS pod over the debug variant. |
| `iOSVersion` | `""` | Pin a specific iOS pod version; empty = newest in the supported range. |
| `AndroidVersion` | `""` | Pin a specific Android Connect SDK version; empty = newest in the supported range. |
| `PushEnabled` | `false` | Master switch. On Android, also gates the `connect-push-fcm` artifact inclusion. |
| `iOSPushMode` | `"automatic"` | iOS-only: `"automatic"` (SDK owns APNs delegate) or `"manual"` (app owns it). Ignored when `PushEnabled` is `false`. |
| `iOSAppGroupIdentifier` | `null` | iOS App Group shared with the Notification Service / Notification Content extension. |
| `AndroidNotificationIconResName` | `null` | Drawable resource name (no extension) for the Android notification small icon. |

## Using with Expo SDK 55+

Expo SDK 55 and newer is supported via the bundled Expo Config Plugin.
**Development builds only** — Expo Go is not supported: Nitro Modules and
native push registration require native code that Expo Go cannot load. There
is no runtime Expo Go detection or fallback; use
[`expo-dev-client`](https://docs.expo.dev/develop/development-builds/introduction/)
or EAS Build.

### Install

```bash
npx create-expo-app@latest my-app    # Expo SDK 55+, new architecture enabled
cd my-app
npx expo install expo-dev-client expo-build-properties
npm install react-native-acoustic-connect react-native-nitro-modules
```

`expo-build-properties` is needed to raise Android `minSdkVersion` to 26
(the Connect Android SDK floor — Expo templates default to a lower value):

```json
{
  "expo": {
    "plugins": [
      ["expo-build-properties", { "android": { "minSdkVersion": 26 } }]
    ]
  }
}
```

### Configure

1. Put `ConnectConfig.json` at the project root — the same file documented in
   [Installation](#installation). For push, set `PushEnabled`, `iOSPushMode`,
   `iOSAppGroupIdentifier`, and `iOSDevelopmentTeam` (your 10-char Apple Team
   ID) in the `Connect` block. Run `npx acoustic-connect doctor` to validate it
   — when `PushEnabled` is `true`, the doctor **fails** (exits non-zero) on any
   missing push input (collector URLs, App Group, signing team,
   `google-services.json`, app ids); when push is off it needs only `AppKey`.

2. Add the plugin to `app.json`:

```json
{
  "expo": {
    "plugins": ["react-native-acoustic-connect"]
  }
}
```

The plugin reads the App Group from `Connect.iOSAppGroupIdentifier` and the
signing team from `Connect.iOSDevelopmentTeam` in `ConnectConfig.json` — the
same values the SDK reads at runtime, so the entitlement and the runtime config
agree by construction. To override either for the native project only (rarely
needed), pass plugin props; props take precedence over `ConnectConfig.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-acoustic-connect",
        {
          "iosAppGroupIdentifier": "group.com.example.myapp",
          "iosDevelopmentTeam": "ABCDE12345"
        }
      ]
    ]
  }
}
```

`iosDevelopmentTeam` is **required for push**: during `expo prebuild` the plugin
stamps `DEVELOPMENT_TEAM` onto the host app and both push extensions. Without a
team, a CLI build falls back to ad-hoc signing, which drops the `aps-environment`
entitlement — so iOS issues no APNs token and push silently fails.

### Build

```bash
npx expo prebuild
npx expo run:ios -- --extra-params "-allowProvisioningUpdates"   # or: eas build --profile development --platform ios
npx expo run:android    # or: eas build --profile development --platform android
```

**iOS push needs provisioning.** Setting `iOSDevelopmentTeam` lets the plugin
stamp the team, but `xcodebuild` still has to fetch/create the Development
certificate and provisioning profiles (the host + both extension App IDs, with
the Push Notifications and App Groups capabilities). Pass
`-allowProvisioningUpdates` so it does that automatically — it requires your
Apple ID to be added once in **Xcode → Settings → Accounts**. `eas build`
manages the whole signing chain itself, so no flag is needed there; CI/headless
runs can use an App Store Connect API key
(`-authenticationKeyPath/-authenticationKeyID/-authenticationKeyIssuerID` with
`-allowProvisioningUpdates`). For the bare workflow, the equivalent is
`react-native run-ios --extra-params "-allowProvisioningUpdates"`.

During `expo prebuild` the plugin automatically:

- adds a `ConnectNSE` Notification Service Extension target to the Xcode
  project (rich-media push attachments + delivery tracking), with
  `NotificationService.swift` generated from the SDK template;
- adds a `ConnectNCE` Notification Content Extension target (rich expansion
  UI — renders the attached media / expanded body when the user expands an
  Acoustic notification), with `NotificationViewController.swift` generated
  from the SDK template;
- adds the App Group entitlement to the host app and to both extensions, so
  all three processes share the same pending store;
- appends `ConnectNSE` and `ConnectNCE` targets to the generated `Podfile`,
  each linking the same Connect SDK pod as the app.

Re-running `expo prebuild` — with or without `--clean` — is idempotent: no
duplicate targets, entitlements, or Podfile entries.

The NCE renders notifications whose category matches
`ACOUSTIC_RICH_NOTIFICATION` or `ACTIONABLE_NOTIFICATION` (the categories the
Connect backend sets on rich-media pushes). No app-side configuration is
required — the category identifiers are baked into the generated target's
`Info.plist`.

### EAS Build

The plugin works with [EAS Build](https://docs.expo.dev/build/introduction/)
out of the box — the NSE and NCE targets are provisioned by the same
`expo prebuild` step EAS runs on its build workers. iOS extension targets are
signed automatically when you use EAS-managed credentials (`eas credentials`),
which provisions the host app and both extension App IDs together.

```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

A working example — including a sample
[`eas.json`](Examples/expo/eas.json) — lives in
[`Examples/expo`](Examples/expo).

## Quick start

### 1. Initialise the SDK

The SDK **auto-initialises** at module load time using the values from
`ConnectConfig.json`. For most apps there is no JS-side init code to write —
just import the package and you're done:

```ts
// index.js
import AcousticConnectRN from 'react-native-acoustic-connect'
// SDK is already initialising on the main actor / main looper. No further
// setup required.
```

For consent-gated apps (GDPR, CCPA, COPPA), use the lifecycle pair:

```ts
import AcousticConnectRN from 'react-native-acoustic-connect'

// At app start, if you don't yet have user consent:
AcousticConnectRN.disable()

// Later, after the user opts in:
AcousticConnectRN.enable()
```

`enable()` and `disable()` are both parameterless — all configuration comes
from `ConnectConfig.json`. They're idempotent at the native layer; calling
`enable()` on an already-running SDK is a no-op.

### 2. Add the `<Connect>` wrapper (declarative, in your tree)

Wrap your `NavigationContainer` in `<Connect>` to enable navigation tracking,
touch capture, and optional keyboard / dialog interception. The wrapper does
not own SDK lifecycle — that's been done in step 1 — so it can mount, unmount,
or remount freely without disrupting the session.

```tsx
import { useNavigationContainerRef, NavigationContainer } from '@react-navigation/native'
import { Connect } from 'react-native-acoustic-connect'

export default function App() {
  const navigationRef = useNavigationContainerRef()
  return (
    <Connect
      navigationRef={navigationRef}
      captureKeyboardEvents
      captureDialogEvents
    >
      <NavigationContainer ref={navigationRef}>
        {/* your screens */}
      </NavigationContainer>
    </Connect>
  )
}
```

`<Connect>` is optional. Apps that only need custom event logging (no automatic
screen / touch / keyboard tracking) can skip it entirely.

### 3. Log events (imperative, anywhere)

```ts
import AcousticConnectRN from 'react-native-acoustic-connect'

// Custom application event
AcousticConnectRN.logCustomEvent('checkout_started', { cartId: 'abc' }, 1)

// Force a logical screen name (e.g. for non-NavigationContainer screens)
AcousticConnectRN.setCurrentScreenName('CheckoutScreen')

// Manual exception capture
AcousticConnectRN.logExceptionEvent(
  'Payment failed',
  err.stack ?? '',
  /* unhandled */ false
)
```

Dialog tracking helpers (`useDialogTracking`, `DialogListener`,
`withAcousticAutoDialog`) instrument React Native `Alert.alert(...)` and custom
dialogs automatically. See the
[developer portal](https://developer.goacoustic.com/acoustic-connect/docs/react-native-integration)
for details.

## API reference

### `AcousticConnectRN.enable(): boolean`

Re-enables the SDK after a prior `disable()`. Reads all configuration from
`ConnectConfig.json`. Returns `true` on accepted dispatch; `false` only when
the platform can't satisfy a precondition (e.g. Android without an
`Application` context yet). Idempotent — the native SDK short-circuits if it's
already running.

> The SDK also auto-initialises at module load using the same configuration,
> so you typically don't need to call `enable()` at all. The method exists to
> pair with `disable()` for opt-out / consent flows.

### `AcousticConnectRN.disable(): boolean`

Stops data capture, flushes pending messages, releases push state. Idempotent.

### Push configuration (`ConnectConfig.json`)

| Field | Type | Default | Semantics |
| --- | --- | --- | --- |
| `PushEnabled` | boolean | `false` | Cross-platform master switch. On Android, drives `connect-push-fcm` artifact inclusion at build time. |
| `iOSPushMode` | `"automatic"` / `"manual"` | `"automatic"` | iOS-only. Ignored when `PushEnabled` is `false`. |
| `iOSAppGroupIdentifier` | string \| null | `null` | iOS App Group shared with NSE / NCE for rich push payloads. Required when push is on. |
| `iOSDevelopmentTeam` | string \| null | `null` | 10-char Apple Team ID used to sign the host + push extensions. Required for iOS push — without it the build drops `aps-environment` and the OS issues no APNs token. |
| `AndroidNotificationIconResName` | string \| null | `null` | Drawable resource name for the Android notification small icon. |

> When `PushEnabled` is `true`, `npx acoustic-connect doctor` treats the
> push-required inputs above (plus collector URLs, `google-services.json`, and
> the app ids) as **hard failures** and exits non-zero. When push is off it
> validates only `AppKey` — a non-push integration needs nothing more.

#### iOS push modes

- `"automatic"` — the iOS Connect SDK manages APNs token registration internally. The host app only requests user permission via `UNUserNotificationCenter`; token delivery and forwarding to the Connect backend are handled by the SDK.
- `"manual"` — the host app owns APNs delegate callbacks (`application(_:didRegisterForRemoteNotificationsWithDeviceToken:)`) and forwards tokens explicitly via `ConnectSDK.shared.push.didRegisterWithToken(token)`.

#### Android push

The `iOSPushMode` field is iOS-only; Android push is gated solely by
`PushEnabled`. On Android, FCM requires a `FirebaseMessagingService` subclass
that the host app declares in its `AndroidManifest.xml`, so push is always
app-driven. The host app is responsible for:

- shipping `google-services.json` in `android/app/`,
- implementing `FirebaseMessagingService.onNewToken(...)`,
- forwarding the FCM token to the Connect SDK.

The Android push-forwarding API itself is wired under follow-up work — until
that lands, `PushEnabled: true` on Android only changes which artifact is on
the classpath; the host-side token forwarding API is not yet exposed.

### `<Connect>` props

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` | yes | Your `NavigationContainer` (or any subtree). |
| `navigationRef` | `RefObject` | recommended | Ref from `useNavigationContainerRef()`. Enables screen-name tracking. |
| `captureKeyboardEvents` | `boolean` | yes | Capture iOS/Android keyboard show/hide events. |
| `captureDialogEvents` | `boolean` | no (default `false`) | Auto-track `Alert.alert(...)` calls. |

### Other methods

The plugin exposes the full Connect SDK surface — custom events, signals,
exceptions, location, screen layout, click / text-change events, dialog events,
and config-item getters/setters. Signatures are stable across platforms; see
`src/specs/react-native-acoustic-connect.nitro.ts` for the typed Nitro spec and
the
[developer portal](https://developer.goacoustic.com/acoustic-connect/docs/react-native-integration)
for end-to-end recipes.

## Migration from earlier versions

See [Migration-Guide.md](./Migration-Guide.md) for the steps to move from the
legacy `NativeModules.AcousticConnectRN` interface to the current ESM exports
and the `<Connect>` component.

## Troubleshooting

### `npm install` peer-dependency conflicts

This package pins `react-native-nitro-modules` to an **exact** version (see
[Nitro version pin](#nitro-version-pin)). If `npm install` errors on the Nitro
peer, your app is resolving a *different* Nitro version. Check it with:

```bash
npm ls react-native-nitro-modules
```

**Supported fix:** align your app to the exact version this package requires
(and match React Native / React per the [Requirements](#requirements)).

`--legacy-peer-deps` / `--force` will silence the error, but the pin is
intentional: a mismatched Nitro version can break the SDK at runtime (an
init-time `ClassNotFoundException`), and bypassing means **you take on that
risk** — we cannot guard against breaking changes in arbitrary Nitro patch
releases. Match the version rather than bypass it.

### iOS — push session reaches the collector but no notifications arrive (no APNs token)

A CLI build (`expo run:ios` / `react-native run-ios` / `xcodebuild`) doesn't
auto-pick a signing team the way the Xcode GUI does. With no team, it signs
ad-hoc and **drops the `aps-environment` entitlement**, so iOS issues no APNs
token — the app still launches and analytics reach the collector, but no
`pushRegistration` (with a `mobileToken`) is ever sent. Fix:

1. Set `Connect.iOSDevelopmentTeam` (10-char Apple Team ID) in
   `ConnectConfig.json` (or pass the `iosDevelopmentTeam` plugin prop). Re-run
   `expo prebuild` / `npx acoustic-connect setup-ios-push` so the team is
   stamped on the host + extensions.
2. Build with `-allowProvisioningUpdates` (see [Build](#build)) and your Apple
   ID added in Xcode → Settings → Accounts, so a Development certificate +
   profiles are provisioned.

`npx acoustic-connect doctor` fails with this exact remedy when push is on and
the team is missing (or when no Development certificate is in your keychain).

### iOS — Expo Android build fails: `No matching client found for package name …`

Your `app.json` `android.package` isn't registered in the active
`google-services.json` (FCM matches by package). The config plugin and
`acoustic-connect doctor` now catch this up front. Register that exact package
in the same Firebase project and re-download `google-services.json` — and note
that **changing `android.package` requires a clean prebuild**
(`npx expo prebuild --platform android --clean`); an incremental prebuild keeps
the stale `applicationId`.

### iOS — `pod install` fails with `[Connect] requires AcousticConnect >= 2.0.5`

You've pinned an older `iOSVersion` in `ConnectConfig.json`. Bump it to a
2.0.5+ release (or leave it empty for the newest available) and re-run
`pod install`.

### Android — Gradle resolution fails on `io.github.go-acoustic:connect`

The strict constraint at `[11.0.11, 12.0.0)` is rejecting your pin. Bump
`AndroidVersion` in `ConnectConfig.json` to a release within that range (or
leave it empty for the newest 11.x available). 12.x is intentionally outside
the supported range pending compatibility validation — track that work
separately if you need it.

### Gradle can't find `node`

Common when Gradle is launched outside an NVM-loaded shell. Either:

- Stop the daemon (`./gradlew --stop`) and re-run `npm run android` from a
  shell where `which node` resolves, or
- Symlink node onto a stable PATH: `ln -sf "$(which node)" /opt/homebrew/bin/node`.

---

For more, see the
[Connect React Native integration guide](https://developer.goacoustic.com/acoustic-connect/docs/react-native-integration)
and the
[sample app walk-through](https://developer.goacoustic.com/acoustic-connect/docs/build-a-sample-react-native-app).
