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
- JDK 17 or newer for Android builds — the same JDK React Native 0.82 itself
  requires. The Android module compiles at Java 17; newer JDKs work.
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

### What `npm install` / `pod install` do for you

Both commands run bootstrap steps against **your** project, not just the
package's own build:

- `npm install` triggers a postinstall step that (idempotently, best-effort):
  - scaffolds a starter `ConnectConfig.json` at your project root if one
    isn't already there,
  - adds the Android permissions Connect needs
    (`INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`,
    `ACCESS_FINE_LOCATION`) to `android/app/src/main/AndroidManifest.xml`,
  - wires `android/app/build.gradle` to apply the SDK's `config.gradle`.
- `pod install` merges your `ConnectConfig.json` into the iOS pod's
  generated config bundle at install time (see the podspec).

None of this touches files outside your project's `android/`/`ios/`
directories, and re-running either command is safe. After install, run
`npx acoustic-connect doctor` to validate the result — see
[Setup CLI](#setup-cli-acoustic-connect) below.

### Where the Android Connect SDK is resolved from

You don't need to add any repositories. This package's `android/build.gradle`
declares both of the ones it needs, and your app inherits them:

| Repository | Carries |
| --- | --- |
| [`go-acoustic/Android_Maven`](https://github.com/go-acoustic/Android_Maven) | Beta builds (`-beta` versions) |
| Maven Central | Release builds and the older version history |

Beta artifacts are published only to the GitHub-hosted repository, so a build
that does not declare it never sees them. When `AndroidVersion` is empty the
version is resolved dynamically, and Gradle takes the newest match across
*both* repositories — the beta repository does not need to be consulted first
for a new beta to win. It is scoped to the `io.github.go-acoustic` group, so
nothing else in your build is routed through it, and Maven Central still
answers for any version the beta repository does not carry.

This matters when you pin. Leaving `AndroidVersion` empty resolves the newest
version in the supported range across **both** repositories — which, for as
long as betas are the newest builds, means a `-beta`. Pin `AndroidVersion` to
a specific release if you would rather track Maven Central's release line.

## Setup CLI (`acoustic-connect`)

The package ships a small CLI, installed as `acoustic-connect` (invoke it with
`npx acoustic-connect <command>`), that validates and scaffolds the native
side of an integration. Both commands auto-detect bare RN vs. Expo and are
idempotent — safe to re-run, and they never overwrite a file that's already
there.

### `npx acoustic-connect doctor [dir] [--require-push]`

Checks the things that otherwise fail late and confusingly at build time:

- Node version.
- `ConnectConfig.json` values — `AppKey`, `PostMessageUrl` / `KillSwitchUrl`
  (must be real `https` URLs, not the placeholder host), `iOSAppGroupIdentifier`
  format, `iOSDevelopmentTeam` format.
- Android identifiers — the package/namespace is a Java-safe name, and it has
  a matching client in `google-services.json` (Expo also checks for a stale
  `android/` from an incremental `expo prebuild` after an `android.package`
  change).
- iOS entitlements — bare projects need `aps-environment` + an App Group
  entitlement (from `setup-ios-push`, below, or hand-authored).
- (macOS only) whether a local Apple Development signing identity is
  installed, when push is on.

The push-related checks above are **hard failures** only when
`Connect.PushEnabled` is `true` (or `--require-push` is passed) — a non-push
integration only needs `AppKey`. `doctor` exits non-zero on any failure, so
it's usable as a CI gate (`npx acoustic-connect doctor --require-push`).

`dir` defaults to the current directory. If `ConnectConfig.json` is missing,
`doctor` scaffolds it first (from a project-local `ConnectConfig.example.json`
if you have one, else from the copy bundled with the package) before running
the checks above — so it's also a fine first command to run in a fresh
project.

### `npx acoustic-connect setup-ios-push [dir]`

Bare-workflow only — the Expo Config Plugin does the equivalent automatically
on `expo prebuild`. Scaffolds the two iOS push extensions:

- `ConnectNSE` (Notification Service Extension — rich-media attachments,
  delivery tracking)
- `ConnectNCE` (Notification Content Extension — expanded rich-media UI)

It writes each extension's Swift source, `Info.plist`, and entitlements from
the SDK's templates (substituting your App Group), adds the App Group +
`aps-environment` entitlement to the host app if it doesn't have one yet, and
wires both targets into your `.xcodeproj` via a bundled Ruby script — which
needs `ruby` and the `xcodeproj` gem (`gem install xcodeproj`; ships with
CocoaPods, so most Mac dev setups already have it).

Requires macOS and `Connect.iOSAppGroupIdentifier` already set in
`ConnectConfig.json` — run `doctor` first if it's missing.

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
import AcousticConnectRN, { TLTRN } from 'react-native-acoustic-connect'

// Custom application event (flat key/value pairs)
AcousticConnectRN.logCustomEvent('checkout_started', { cartId: 'abc' }, 1)

// Signal — accepts arbitrary JSON, including nested objects and arrays
AcousticConnectRN.logSignal(
  {
    signalContent: { signalType: 'pageview', pageCategory: 'checkout' },
    audience: [{ name: 'Account ID', value: '4815162342' }],
  },
  1
)

// Force a logical screen name (e.g. for non-NavigationContainer screens).
// Sets the name that later events are attributed to — it does not itself emit
// a screen view or capture a layout. For a screen <Connect> cannot see, follow
// it with logScreenLayout, which does both.
AcousticConnectRN.setCurrentScreenName('CheckoutScreen')
TLTRN.logScreenLayout('CheckoutScreen')

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

> **What the logging methods' `boolean` means.** Every `log*` method returns
> whether the native SDK **accepted the event for delivery** — never whether
> the collector received it, and never whether the collector kept it. Events
> are queued on device and posted in batches later, so no return value from
> these calls can attest to delivery, and a server-side rejection (a signal
> that fails schema validation, say) happens long after you have already been
> told `true`. Treat the value as "the SDK took this", and use the collector or
> the platform log as the source of truth for what shipped.
>
> A `false` means the SDK rejected the call outright and nothing was queued.
> The bridge also writes that to `logcat` (tag `AcousticConnectRN`) and
> `os_log` (subsystem `com.acoustic.AcousticConnectRN`, category `bridge`), so
> a rejection is visible without inspecting return values you would otherwise
> never read.
>
> `logScreenLayout` is weaker still: with the configured delay — the normal
> case — a `true` means only that the capture was **scheduled**. What the
> capture found when it eventually ran, and whether it produced a layout
> message at all, is reported in the platform log only.

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

### `AcousticConnectRN.logSignal(values, level): boolean`

Logs a signal. `values` accepts **arbitrary JSON** — nested objects and arrays,
not just scalars — and the payload is carried through without flattening or
reshaping:

```ts
AcousticConnectRN.logSignal(
  {
    signalContent: {
      signalType: 'pageview',
      url: 'https://app.example.com/dashboard',
      pageCategory: 'dashboard',
    },
    audience: [
      { name: 'Account Name', value: 'Acme Corp' },
      { name: 'Account ID', value: '4815162342' },
    ],
  },
  1
)
```

Flat scalar payloads keep working unchanged — the type is a superset of
`Record<string, string | number | boolean>`.

An object literal needs no type import. If you want to *name* a payload — a
shared constant, a helper parameter — the package exports `SignalValues` for it:

```ts
import AcousticConnectRN, {
  type SignalValues,
} from 'react-native-acoustic-connect'

const pageView: SignalValues = {
  signalContent: { signalType: 'pageview', pageCategory: 'checkout' },
}

AcousticConnectRN.logSignal(pageView, 1)
```

> **Android: top-level numbers need Connect Android 11.0.24-beta or newer.**
> Android's signal serializer gained a number branch in Connect Android
> **11.0.24-beta**; from that version a top-level numeric value is carried, the
> same as on iOS. Earlier versions carried strings, booleans, objects and arrays
> at the top level but dropped a top-level number. Numbers nested inside an
> object or array were never affected on either platform.
>
> Both versions sit inside the `[11.0.11, 12.0.0)` range this package accepts,
> and the Android dependency floats to the newest published build unless you pin
> it, so most integrations get the new behaviour. Nest the number if you pin an
> older one:
>
> ```ts
> AcousticConnectRN.logSignal({ cart: { items: 3 } }, 1) // any supported version
> AcousticConnectRN.logSignal({ items: 3 }, 1)           // iOS, + Android 11.0.24-beta and newer
> ```

### `AcousticConnectRN.logCustomEvent(eventName, values, level): boolean`

Logs a named custom event. Unlike `logSignal`, `values` is **flat** — strings,
numbers and booleans only. The Android SDK's custom-event path is typed for
string values end to end, so there is no native route for nested JSON; widening
it would preserve the nesting on iOS and silently drop it on Android. Use
`logSignal` when the payload needs structure.

TypeScript will reject a nested value, but types are erased at runtime — a
payload built from an API response or widened through `any` still reaches the
bridge nested, gets reshaped by the native SDK, and returns `true`. The wrapper
logs a `console.warn` naming the offending keys when that happens (once per
call site, in dev and in production; the payload itself is passed through
unchanged). If you see it, move the payload to `logSignal`.

Numbers are rendered the same way on both platforms — a JS `2` arrives as `2`,
not `2.0`. Note the remaining difference in *type*: because the Android path is
string-typed, an Android custom-event number lands on the wire as a JSON string
(`"2"`) where iOS sends a JSON number (`2`). `logSignal` carries native types on
both platforms; reach for it when a dashboard or Composer rule compares the
value numerically.

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

### Screen-capture configuration (`ConnectConfig.json`)

Screen layout and screenshot capture are configured per platform, because the
two native SDKs read their defaults from different places.

| Field | Type | Default | Semantics |
| --- | --- | --- | --- |
| `layoutConfig` | object \| absent | absent | Shared baseline for both platforms. Supports `AutoLayout` (screen capture rules) and `AppendMapIds`. |
| `layoutConfigIos` | object \| absent | absent | iOS-specific overrides, deep-merged over `layoutConfig`. |
| `layoutConfigAndroid` | object \| absent | absent | Android-specific overrides, deep-merged over `layoutConfig`. |
| `GetImageDataOnScreenLayout` | boolean | SDK default | Cross-platform. When `false`, layout messages carry no screenshot image data. |

`AutoLayout` holds a `GlobalScreenSettings` object plus optional per-screen
overrides keyed by screen name, where a per-screen value wins over the global
one. To turn screenshot capture off on both platforms:

```json
{
  "Connect": {
    "layoutConfig": {
      "AutoLayout": {
        "GlobalScreenSettings": { "ScreenShot": false }
      }
    }
  }
}
```

`ScreenShot` is the cross-platform switch — set it in `layoutConfig` (or per
platform) and both native SDKs honour it. `CaptureScreenshotOn` is a related
but **iOS-only** key: iOS's native auto-instrumentation reads it, but on
Android the equivalent reader has no callers, so `CaptureScreenshotOn` is
accepted wherever you put it and does nothing there. Set it only under
`layoutConfigIos` if you want it; leaving it out of `layoutConfigAndroid` (or
the shared `layoutConfig`) costs nothing on Android and avoids implying it
does something it doesn't.

Put anything common in `layoutConfig` and use `layoutConfigIos` /
`layoutConfigAndroid` only for what differs. The platform block is **deep-merged**
over the shared one, so it refines the baseline rather than replacing it: an
iOS block setting just `ScreenShot` keeps the shared `Masking`, per-screen
rules, and every other shared value. Arrays are replaced outright rather than
concatenated, so a platform block can shorten or clear a shared list such as
`MaskIdList`.

#### Masking is selection, then redaction — an unmatched pattern leaves data unmasked

A screen rule's `Masking` block works in two independent steps: a control is
first **selected** by a matching `MaskIdList` (control id), `MaskValueList`
(control value), `MaskAccessibilityIdList` (accessibility id), or
`MaskAccessibilityLabelList` (accessibility label) pattern, and only a
*selected* control is redacted — its value, and (Connect iOS 2.1.22+ / Android
11.0.23-beta+ only — older SDKs serialised the accessibility object verbatim
regardless of masking) its accessibility label and hint. A control whose value
never matches any pattern in any of the four lists is not masked in any field.
That's by design, not a bug — but it means a client whose patterns don't
happen to match a given value can believe that value is masked when it never
was.

Email addresses are an easy miss: they rarely match a card-number or
`SECRET-`-style pattern, and free-text fields (bios, support messages,
usernames) routinely contain one. For any screen that collects email
addresses, add a pattern to `MaskValueList`:

```json
{ "MaskValueList": ["[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}"] }
```

(The `bare-workflow` and `expo` sample `ConnectConfig.example.json` already
ship this pattern on `GlobalScreenSettings`.)

When no block applies, each native SDK keeps the defaults from its own bundled
layout config:

- **iOS** — the defaults ship inside the Connect pod's `ConnectResources.bundle`
  and are copied into your `.app`, so `pod install` replaces them on every run.
  There is no app-level override file, which is why `ConnectConfig.json` is the
  only supported route — do not edit anything under `Pods/`.
- **Android** — the plugin writes your merged block to its own
  `ConnectLayoutConfig.json` asset. If your app ships
  `android/app/src/main/assets/ConnectLayoutConfig.json`, Android asset merging
  gives **your** copy priority and the `ConnectConfig.json` block is ignored;
  the build prints a warning when both exist. Keep one or the other.

> Turning screenshots off does not disable behavioural capture: screen views,
> clicks, and custom events still flow. It only drops the image data, which is
> what a subscription without session replay has no consumer for.

#### `NumberOfWebViews` turns off iOS layout capture — leave it at `0`

`AutoLayout` rules accept a `NumberOfWebViews` key. On iOS, any value greater
than zero marks the screens that rule covers as web-view screens, and the SDK's
automatic layout capture is skipped for a web-view screen. Its effect is not
limited to screens that actually host a `WebView`: the value is read as a
declaration about the rule, not a count that gets verified.

The trap is where it is usually set. `GlobalScreenSettings` is the rule that
applies to **every** screen with no more specific rule of its own, and React
Native screens are all in that position — they are hosted by the same generic
container class, so no per-screen native rule matches them. So a single
`"NumberOfWebViews": 1` under `GlobalScreenSettings` switches off
auto-instrumented layout capture for the entire app on iOS, including screens
with no web content at all:

```json
{
  "Connect": {
    "layoutConfigIos": {
      "AutoLayout": {
        "GlobalScreenSettings": { "NumberOfWebViews": 0 }
      }
    }
  }
}
```

Screen views, clicks, and custom events are unaffected — the symptom is layout
messages going missing while everything else keeps arriving, which reads like a
capture failure rather than a setting. Keep `NumberOfWebViews` at `0`, the value
every shipped template uses. To stand layout capture down deliberately, set
`CaptureLayoutOn: 0` on the rule instead — it is the key that means that, and it
leaves `NumberOfWebViews` free to describe the screen.

#### WebView capture on Android: prerequisites and two open limitations

A screen that hosts a `react-native-webview` `WebView` has capture behaviour
beyond the config above:

- **The WebView must be scrolled on screen.** A capture only records what is
  currently visible — the native tree-walk skips subtrees outside the
  viewport by design. A `WebView` sitting below the fold at the default
  scroll position yields a layout with no WebView nodes at all, which looks
  exactly like WebView capture never engaged. Scroll it fully into view
  before triggering (or waiting on) a capture.
- **`GoogleWebViewEnabled`** is a top-level `Connect` key (Android only,
  default `true`) that gates whether the SDK instruments WebViews at all:

  ```json
  { "Connect": { "GoogleWebViewEnabled": false } }
  ```

  Set to `false`, the SDK does not discover or walk into any `WebView` on the
  screen — the rest of that screen still captures normally. It does not gate
  anything else on this list: screen views, clicks, and non-WebView layout
  content are unaffected either way.
- **A discovered WebView currently drops that screen's whole layout
  message.** Once the SDK finds a `WebView`, it waits for a DOM-capture
  correlation id from the page before it can finish and post the layout — and
  a React Native-hosted `WebView` never supplies one, so the wait never
  resolves and the *entire* screen's layout message is dropped, not just the
  WebView's portion. Confirmed present in Android Connect **11.0.23-beta**, the
  newest published artifact at the time of writing, and in every earlier version
  in the supported range — measured on an emulator, where a capture on a screen
  with a visible `WebView` posted **no messages at all** for that session, since
  the layout's queue placeholder blocks the batch it sits in. There is no
  client-side fix; `GoogleWebViewEnabled: false` (below) avoids it by not
  instrumenting the `WebView` in the first place. A fix exists in the native SDK
  but is not in any published artifact yet — check the Android Connect release
  notes for a version above 11.0.23-beta before assuming this still applies.
- **Enabling WebView capture replaces the app's `WebViewClient`.** The native
  SDK installs its own `WebViewClient` on that `WebView` to instrument it, in
  place of the one `react-native-webview` had set — so callbacks such as
  `onHttpError` and `onNavigationStateChange` on that `WebView` stop firing
  while capture is active. Same status as the item above: present through Android
  Connect **11.0.23-beta**, fixed in the native SDK but not yet published, and
  the rest of the screen is unaffected either way.

Both of the limitations above only occur once the SDK is instrumenting a
`WebView`, so `GoogleWebViewEnabled: false` avoids both — at the cost of
getting no WebView capture on that screen at all.

#### Capture timing (`CaptureLayoutDelay`)

`AutoLayout.GlobalScreenSettings.CaptureLayoutDelay` is how long, in
milliseconds, the SDK waits before capturing the layout. It matters more in
React Native than in a native app: the wrapper triggers capture from React
Navigation's state change, which fires at the *start* of a screen transition,
whereas a native app captures from the view-controller lifecycle, after it. Too
short a delay and the capture catches a half-drawn screen.

The templates ship `500`, which clears a typical transition animation on both
platforms. Tune it globally, or per screen for one that is slower than the
rest:

```json
{
  "Connect": {
    "layoutConfig": {
      "AutoLayout": {
        "GlobalScreenSettings": { "CaptureLayoutDelay": 500 },
        "Checkout": { "CaptureLayoutDelay": 900 }
      }
    }
  }
}
```

`TLTRN.logScreenLayout(name)` uses the configured value. Pass a second argument
to override it for one call — `TLTRN.logScreenLayout(name, 0)` captures
immediately, `TLTRN.logScreenLayout(name, 900)` waits 900 ms.

A fixed delay cannot cover a screen whose content arrives asynchronously: if
data lands after the delay elapses, the capture shows the screen without it.
Raising the global delay to cover the slowest fetch delays every other screen
too. Call `TLTRN.logScreenLayout(name)` again when the content is on screen
instead — each call captures the layout as it stands at that moment.

Leaving the block out entirely gives you 500 ms as well. That is the wrapper's
default, chosen so both platforms behave the same; the native SDKs' own bundled
defaults differ from each other and are tuned for the lifecycle trigger rather
than the React Navigation one. Internally, omitting the second argument to
`TLTRN.logScreenLayout` sends a sentinel (`-1`) that both bridges resolve to
this configured value; any value the caller passes explicitly (`>= 0`) is used
as-is instead, bypassing the config lookup for that one call.

A near-zero value is not a request for faster captures. On iOS the
auto-instrumentation capture is triggered off the view-controller lifecycle,
and a delay close to `0` lets that trigger re-fire against the same screen far
faster than the app can settle — hundreds of captures within a couple of
hundred milliseconds while the app just sits idle, rather than one per actual
transition. The visible symptom is a runaway capture loop: a "Refreshing…"
indicator that stays up continuously instead of the brief one after a normal
transition. The SDK enforces no floor on this value, so `1` (millisecond) is
accepted and is exactly what produces the loop. Keep `CaptureLayoutDelay` at
`500` or raise it per screen — never lower it toward `0`.

#### Where screen-view and layout messages come from, and how to reduce duplicates

The two message kinds have different sources, and they differ per platform:

**Screen views (one source per platform).** On Android, the `<Connect>` wrapper
is the *only* source — it emits on React Navigation's `state` event. On iOS,
the native SDK's auto-instrumentation is the *only* source — it emits when a
screen's view controller reports its appearance. The wrapper never emits a
screen view on iOS; its role there is to hand the current *route name* to the
native SDK (which is what makes messages read `Checkout` rather than a native
container class) and to drive referrer chaining across transitions.

Duplicate screen views observed on iOS are therefore not two sources
overlapping — they are the single native source firing more than once when the
same screen's view controller reports several appearances for one transition.
They inflate event volumes and skew per-screen counts; they do not lose data.
There is no configuration key that collapses them today; a native-side dedupe
is under investigation. Do not try to solve it by removing the wrapper: on iOS
that costs route-based names and referrer chaining, and on Android it removes
screen views entirely. A same-name filter in the wrapper would not help either
— the wrapper is not the emitter on iOS, and such a filter would swallow
legitimate repeats like a stack pushing the same screen name twice.

**Layouts (two sources on iOS).** With automatic layout capture enabled in
config, an iOS transition can produce two layout messages: one from the
wrapper's `logScreenLayout` call and one from the native auto-instrumentation.
Control it from config, on the native side that has the duplicate:

```json
{
  "Connect": {
    "layoutConfigIos": {
      "AutoLayout": {
        "GlobalScreenSettings": { "CaptureLayoutOn": 0 }
      }
    }
  }
}
```

`CaptureLayoutOn: 0` stands the **native** automatic layout capture down and
leaves the wrapper's route-named captures as the single source. Set it per
screen rather than globally if only some screens are noisy. Screen views,
clicks, and custom events are unaffected by this key.

If you would rather keep the native captures and have the wrapper stay out of
the way, omit `navigationRef` and do not rely on `<Connect>` for screen naming
— but expect native container class names in place of your route names.

Measure before changing either default: the volume depends on your navigator
structure, and both defaults are what every shipped sample uses.

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

**Fingerprint:** analytics and `pushRegistration` still reach the collector
normally, but `mobileToken` stays `null` forever — and, notably, **no
`didFailToRegisterForRemoteNotificationsWithError` (or any push-related
failure) shows up in logs either.** It just silently never happens. That
absence of any error is what makes this look like a missing/broken app-side
callback or an SDK bug at first glance; it's almost always a signing
artifact instead. Run `npx acoustic-connect doctor` first — it detects this
exact condition (missing/invalid `iOSDevelopmentTeam`, no Development
certificate) up front, before you go digging through portal config.

Cause: a CLI build (`expo run:ios` / `react-native run-ios` / `xcodebuild`)
doesn't auto-pick a signing team the way the Xcode GUI does. With no team, it
signs ad-hoc and **drops the `aps-environment` entitlement**, so iOS issues no
APNs token — the app still launches and analytics reach the collector, but no
`pushRegistration` with a `mobileToken` is ever sent.

**Setting `Connect.iOSDevelopmentTeam` in `ConnectConfig.json` by itself does
nothing.** It's just a source value — it has no effect on the build until
`expo prebuild` / `npx acoustic-connect setup-ios-push` actually stamps
`DEVELOPMENT_TEAM` onto the host **and** the `ConnectNSE` **and** `ConnectNCE`
targets in the generated `.pbxproj`. Re-run that step any time
`iOSDevelopmentTeam` changes, and after every fresh clone — a teammate's
machine may already have the stamp baked in from a prior run; yours doesn't
until you run it too. This is the classic "works for me, not for them" trap:
every portal-side check (App ID push capability, provisioning profile,
entitlements file contents, App Group registration, `.p8` key upload) can
look perfect and still not reflect what's actually embedded in the binary
that got installed on the device.

Fix:

1. Set `Connect.iOSDevelopmentTeam` (10-char Apple Team ID) in
   `ConnectConfig.json` (or pass the `iosDevelopmentTeam` plugin prop). Re-run
   `expo prebuild` / `npx acoustic-connect setup-ios-push` so the team is
   stamped on the host + extensions.
2. Build with `-allowProvisioningUpdates` (see [Build](#build)) and your Apple
   ID added in Xcode → Settings → Accounts, so a Development certificate +
   profiles are provisioned.

**Verify the fix actually landed** — rerunning the steps above isn't proof by
itself; confirm the build artifacts directly:

```bash
# 1. DEVELOPMENT_TEAM must be stamped on the host AND both push extensions
grep DEVELOPMENT_TEAM ios/*.xcodeproj/project.pbxproj

# 2. The *installed* binary must carry the entitlement — check the actual
#    .app, not just the source .entitlements file in your repo
codesign -d --entitlements :- --xml /path/to/YourApp.app
# must show aps-environment in the output
```

If `DEVELOPMENT_TEAM` is missing for any of the three targets, or `codesign`
doesn't show `aps-environment`, the stamp didn't take (or a stale build was
reused) — re-run `setup-ios-push` / `prebuild` and do a clean rebuild.

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

If the version you pinned is a `-beta`, check that your build can reach
[`go-acoustic/Android_Maven`](https://github.com/go-acoustic/Android_Maven) —
beta artifacts live there rather than on Maven Central. This package declares
that repository for you, so a failure here usually means the build is offline
or behind a proxy that blocks `raw.githubusercontent.com`. See
[Where the Android Connect SDK is resolved from](#where-the-android-connect-sdk-is-resolved-from).

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
