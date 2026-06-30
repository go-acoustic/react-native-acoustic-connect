# Examples/expo — Acoustic Connect Expo sample app

The canonical **Expo SDK 55+** reference for the Acoustic Connect React Native
SDK. It consumes the in-repo SDK (`react-native-acoustic-connect` via
`file:../..`) and exercises the full mobile-push surface on iOS (APNs + NSE +
NCE) and Android (FCM).

1. the **Expo Config Plugin** provisions the `ConnectNSE` Notification Service
   Extension **and** the `ConnectNCE` Notification Content Extension targets
   during `expo prebuild`, and
2. the SDK **auto-initialises** from `ConnectConfig.json` in an Expo dev build
   on both iOS and Android.

Expo is only the build tool: the UI is the **shared source** in
[`../shared`](../shared), the exact same screens the
[`bare-workflow`](../bare-workflow) sample uses (imported via the `@shared/*`
path). The two apps are intentionally identical so that NSE/NCE Config-Plugin
regressions surface in either one — the Expo path generates via `expo prebuild`
what bare-workflow wires by hand.

## What it demonstrates

- **Push** tab — notification-permission status + Request Authorization
  (tri-state, refreshes on foreground).
- **Identity** tab — log `loggedIn` / `accountRegistered` identity signals.
- **Behaviour** tab — placeholder for the analytics surface.

The SDK **auto-initialises** at module load from `ConnectConfig.json`; there is
no JS-side `enable(appKey, postURL, …)` — `enable()` is parameterless and only
needed to re-enable after a `disable()`. The `<Connect>` analytics wrapper in
[`src/app/_layout.tsx`](src/app/_layout.tsx) captures screen views and taps.

## Prerequisites

- Node ≥ 20, and the [Expo CLI](https://docs.expo.dev/) (`npx expo`).
- A **development build** — Expo Go is not supported (Nitro Modules + native
  push need native code Expo Go cannot load).
- For iOS device/push: Xcode + an Apple Developer team.
- For Android push: a Firebase project + `google-services.json`.

## Setup

Run the bootstrap doctor — it scaffolds `ConnectConfig.json` from the example,
validates the config (App Group format, Java-safe Android package,
`google-services.json` package match, signing team), and installs dependencies:

```bash
npm run bootstrap
```

When `PushEnabled` is `true`, `acoustic-connect doctor` **fails** (exits
non-zero) on any missing push input; when push is off it needs only `AppKey`.

Then fill in your own values:

1. **App identity in [`app.json`](app.json)** — replace the
   `com.example.connectexpodemo` placeholders for `ios.bundleIdentifier` and
   `android.package` with your own. They must be ids that exist in your
   `google-services.json` (Android/FCM) and your APNs configuration (iOS) before
   you build with push. The SDK validates but never rewrites `app.json`; under
   push the doctor **fails** while they're still on the placeholder.
   **Changing them requires a clean prebuild**
   (`npx expo prebuild --platform android --clean`) — an incremental prebuild
   keeps the stale `applicationId`/`namespace`.
2. **`ConnectConfig.json`** — set `AppKey`, `PostMessageUrl`, `KillSwitchUrl`,
   and (for push) `iOSAppGroupIdentifier` + `iOSDevelopmentTeam` (your 10-char
   Apple Team ID — required so the iOS build embeds `aps-environment`; without
   it the OS issues no APNs token). Single source of truth; **baked into the
   native build at build time** (see Troubleshooting).
3. **`google-services.json`** — for Android FCM. Its package **must** match
   `app.json` → `android.package` (FCM matches by package). Register that
   package in the Firebase console and download the file here.
4. **App Group** — create `iOSAppGroupIdentifier` on the Apple Developer portal
   and enable the App Groups capability on the host app **and** both extension
   App IDs (`<bundleId>.ConnectNSE`, `<bundleId>.ConnectNCE`).

> **Identifiers:** the iOS `bundleIdentifier` may contain any string, but the
> Android `package` is also the Java/Kotlin namespace — it must not contain a
> Java keyword (e.g. `new`). The two may differ; `npm run bootstrap` validates
> this.

> **EAS:** the sample ships no `owner`/`extra.eas.projectId` — run `eas init`
> to attach your own EAS project before `eas build`.

## Run locally (prebuild + dev build)

```bash
npx expo run:ios --device      # or: npx expo run:android
```

`expo run:*` builds the native project (running the Config Plugin during
prebuild), installs, starts Metro, and launches the app. The SDK initialises on
load; no JS-side `enable()` call is needed.

> **Note — the `LockdowndClient ... Cannot convert object to primitive value`
> crash on iOS device installs is patched in this sample.** This was a bug in
> **Expo CLI** (`@expo/cli`), **not** in the Acoustic Connect SDK. `npm install`
> applies the fix automatically (via `patch-package` — see
> [`patches/README.md`](patches/README.md)), so `expo run:ios --device` installs
> cleanly. If you ever hit it again (e.g. a different `@expo/cli` version), the
> build itself still succeeded — install the built app directly and start Metro
> yourself:
>
> ```bash
> xcrun devicectl device install app --device <UDID> \
>   "$(ls -dt ~/Library/Developer/Xcode/DerivedData/*/Build/Products/Debug-iphoneos/*.app | head -1)"
> npx expo start --dev-client
> ```
>
> (Or open `ios/*.xcworkspace` in Xcode and press Run.)

### Verifying the Config Plugin output

During `expo prebuild` the bundled Config Plugin provisions, on iOS:

- a **`ConnectNSE`** Notification Service Extension target (rich-media download),
- a **`ConnectNCE`** Notification Content Extension target (expanded content),
- the App Group entitlement on the host app + both extensions,
- the matching `Podfile` targets.

Confirm after a prebuild:

```bash
npx expo prebuild --clean
grep -c "ConnectNSE.appex" ios/*.xcodeproj/project.pbxproj   # NSE target present
grep -c "ConnectNCE.appex" ios/*.xcodeproj/project.pbxproj   # NCE target present
```

Re-running `expo prebuild` (with or without `--clean`) is idempotent — the
target count stays stable and the App Group entitlement is not duplicated.

On **Android**, the plugin appends an `apply from: …/config.gradle` line to the
generated `android/app/build.gradle`. That makes the SDK's `config.gradle`
propagate `ConnectConfig.json` (`AppKey`, `PostMessageUrl`, …) into the native
collector config at build time — without it the Android build ships the SDK's
default collector and reports nowhere useful. Confirm after a prebuild:

```bash
grep -c "config.gradle" android/app/build.gradle   # the apply line is present (1)
```

## EAS Build

First attach your own EAS project — the sample ships no `owner`/`projectId`:

```bash
eas init
```

After that EAS works like any Expo app — the same `expo prebuild` runs on the
EAS worker, so the NSE + NCE targets are provisioned there too. A sample
[`eas.json`](eas.json) ships with `development`, `preview`, and `production`
profiles.

```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

Two repo-specific pieces make this work and are already wired:

- **`eas-build-pre-install`** (in `package.json`) installs the SDK root's deps
  before EAS's `npm ci`, so the `file:../..` link's `prepare` step (`tsc`)
  resolves on the clean worker.
- A repo-root **`.easignore`** keeps the upload small.

### iOS signing — the team must be set or the archive fails

The Config Plugin provisions the `ConnectNSE` + `ConnectNCE` extension targets,
and since Xcode 14 every extension/resource-bundle target must sign with a
development team. If no team is configured, the EAS archive **fails outright**:

```text
❌ Signing for "ConnectNCE" requires a development team … (target 'ConnectNCE')
❌ Signing for "ConnectNSE" requires a development team … (target 'ConnectNSE')
```

Set your 10-char Apple Team ID so the plugin's signing mod stamps
`DEVELOPMENT_TEAM` onto the host + both extensions during the worker prebuild.
Either source works:

- `Connect.iOSDevelopmentTeam` in `ConnectConfig.json` — the canonical source
  (uploaded to the worker; `.easignore` does not exclude it), **or**
- the `iosDevelopmentTeam` plugin prop in `app.json` — an override, and the more
  robust choice for shared/CI setups because `app.json` is committed whereas
  `ConnectConfig.json` is per-developer:

  ```jsonc
  "plugins": [
    ["react-native-acoustic-connect", {
      "iosDevelopmentTeam": "ABCDE12345",
      "iosAppGroupIdentifier": "group.<your.bundle.id>"
    }]
  ]
  ```

EAS-managed credentials also need provisioning profiles for the two extension
App IDs (`<bundleId>.ConnectNSE`, `<bundleId>.ConnectNCE`). If a build fails on
*provisioning* rather than *team*, run `eas credentials` (or let the interactive
`eas build` prompt) to generate them, and enable the App Groups capability on
the host + both extension App IDs.

## Android push (FCM)

Android push needs **no app code** — the Connect SDK auto-enables the FCM
transport at init (gated by `PushEnabled: true` in `ConnectConfig.json`, which
puts the `connect-push-fcm` artifact on the classpath). It only needs Firebase
to be initialised, which means supplying a `google-services.json`:

1. In a Firebase project, add an Android app whose package name **exactly
   matches** `android.package` in [`app.json`](app.json) —
   `com.example.connectexpodemo`. A mismatch fails the
   build with *"No matching client found for package name …"*.
2. Download `google-services.json` and save it at the **project root**
   (`Examples/expo/google-services.json`) — copy
   [`google-services.json.template`](google-services.json.template) and replace
   it. The file is gitignored.
3. `app.json` already sets `android.googleServicesFile: "./google-services.json"`,
   so `expo prebuild` copies it into `android/app/` and Expo applies the
   `com.google.gms.google-services` Gradle plugin automatically — no config
   plugin or manual Gradle edits required.
4. Register your FCM server key / service-account with the Acoustic Connect
   channel config so the Collector can deliver to your project.

Verify after `npx expo run:android` (logcat):

```text
Firebase Messaging classes found — FCM is available
[bridge] Connect push transport enabled (FCM)
ConnectPush: New token received: …
```

Without `google-services.json` you'll instead see `Default FirebaseApp is not
initialized` / `push enable failed` — that means step 2 is missing.

## Sending a test push + verifying rich media

1. Grant notification permission in the app (Push tab → Request Authorization).
2. Trigger an Acoustic Connect campaign / API push to the device's token with a
   rich-media (image) attachment.
3. **NSE** downloads and attaches the media — the collapsed banner shows the
   thumbnail.
4. **NCE** renders the expanded content when the notification is long-pressed /
   expanded. The push payload's notification **category must match** the NCE's
   `UNNotificationExtensionCategory` configured by the plugin
   (`ACOUSTIC_RICH_NOTIFICATION` / `ACTIONABLE_NOTIFICATION`).

> Rich-media NSE thumbnails and NCE expanded content **cannot** be verified on
> the iOS Simulator — use a physical device.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Android build: *"'new' is a Java keyword"* | `android.package` can't contain a Java keyword. Use a Java-safe package and register it in Firebase. |
| Android build: *no matching client in google-services.json* | The Firebase package must equal `app.json` → `android.package`. Re-register + re-download. The config plugin + doctor now fail fast with this message. After changing `android.package`, run `npx expo prebuild --platform android --clean`. |
| iOS push: session reaches the collector but no notifications (no APNs token) | No signing team → ad-hoc signing drops `aps-environment`. Set `iOSDevelopmentTeam` in `ConnectConfig.json`, re-run `expo prebuild`, and build with `-allowProvisioningUpdates` (`npx expo run:ios -- --extra-params "-allowProvisioningUpdates"`). |
| iOS `run:ios` crashes at install (`LockdowndClient ... Cannot convert object to primitive value`) | **Expo CLI bug, not the SDK** — patched automatically by `npm install` (`patch-package`, see [`patches/README.md`](patches/README.md)). Build is fine regardless; fallback is `xcrun devicectl device install app` (see Run). |
| Config changes don't take effect | `ConnectConfig.json` is baked at build / `pod install` time. Rebuild with `npx expo prebuild --clean` — a Metro reload is not enough. |
| Verifying the effective collector / "no session" | The bridge logs `PostMessageUrl` + `SDK initialised` at **info** level. In **Console.app**: Action → *Include Info Messages*, filter subsystem `com.acoustic.AcousticConnectRN`. The bundled `ConnectBasicConfig.plist` is a pod demo fallback — the runtime collector comes from `ConnectConfig.json` (programmatic init), so ignore the plist. A static screen may not generate signals to flush — background the app, or use the full UI in the sample-app task. |
| Metro serving the wrong code | If you have multiple SDK checkouts, build **and** run Metro from the same one. Kill stray Metro: `lsof -nP -iTCP:8081 -sTCP:LISTEN`. |

See the root [README](../../README.md#using-with-expo-sdk-55) for the full Expo
integration guide and the `app.json` plugin block.
