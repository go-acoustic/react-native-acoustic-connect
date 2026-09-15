# Examples/expo/patches

> **These patches fix bugs in third-party Expo tooling — not in the Acoustic
> Connect SDK.** They are scoped to this sample app only. Nothing here ships in
> the `react-native-acoustic-connect` npm package, and your own app does **not**
> need them unless you hit the same upstream Expo CLI bug.

Patches in this folder are applied automatically:

- **Local installs** — via the `"postinstall": "patch-package"` hook in
  [`../package.json`](../package.json), which runs after `npm install`/`npm ci`.
- **EAS cloud builds** — via the `"eas-build-post-install": "patch-package"`
  hook, which EAS invokes explicitly after it installs the app's dependencies.
  This is independent of `postinstall` on purpose: the `eas-build-pre-install`
  step runs the *root SDK* install with `--ignore-scripts` (to build the Config
  Plugin without triggering the SDK's own lifecycle scripts), so we don't rely
  on lifecycle scripts firing in CI — the explicit `eas-build-post-install`
  hook guarantees the patch is applied in every EAS build.

> **Use `npm ci`, not `npm install`, to guarantee the patch matches.** The
> patch filename is tied to the resolved `@expo/cli` version (see below). The
> committed `package-lock.json` pins `expo` (and therefore its nested
> `@expo/cli`) to the exact version this patch targets, so `npm ci` always
> reproduces it. A plain `npm install` is allowed to re-resolve `expo` within
> its `~55.0.x` range; if that lands on a build whose nested `@expo/cli` differs
> from the patch filename, `patch-package` will warn (and skip if the content no
> longer matches). Prefer `npm ci` locally and in CI; only run `npm install`
> when you intend to update the lockfile, and re-verify/regenerate the patch
> afterwards.

## `expo++@expo+cli+55.0.32.patch`

**What it fixes:** `expo run:ios --device` crashes at the install step on
**iOS 17+** physical devices with:

```
TypeError: Cannot convert object to primitive value
    at LockdowndClient.startSession (@expo/cli/.../client/LockdowndClient.js)
```

**Whose bug it is:** **Expo CLI (`@expo/cli`), not the Acoustic Connect SDK.**
The native build succeeds; only Expo CLI's install step throws. The line
`debug(\`startSession: ${pairRecord}\`)` eagerly stringifies `pairRecord`, which
on iOS 17+ is a null-prototype object (returned by `@expo/plist`'s XML parse as
a prototype-pollution safeguard) with no `toString`/`valueOf`. The patch changes
it to `debug('startSession')`, matching the upstream fix already shipped in
`@expo/cli` 56.x.

**Why patch instead of upgrade:** Expo SDK 55 cannot take `@expo/cli` 56, so the
one-line fix is back-ported here via `patch-package`.

**When to remove:** delete this patch, the `patch-package` devDependency, and the
`postinstall` hook when this sample moves to **Expo SDK 56+** (`@expo/cli` 56.x),
where the fix is already upstream.

**If the patch version drifts:** the filename is tied to the resolved
`@expo/cli` version. If `npm install` resolves a different patch version,
`patch-package` warns but still applies when the content matches. To regenerate:

```bash
# edit node_modules/expo/node_modules/@expo/cli/build/src/run/ios/appleDevice/client/LockdowndClient.js
#   debug(`startSession: ${pairRecord}`);  ->  debug('startSession');
npx patch-package expo/@expo/cli
```

## `expo-modules-core+55.0.25.patch` and `react-native-reanimated+4.2.1.patch`

**What they fix:** `npx expo prebuild --platform android` followed by
`./gradlew :app:assembleDebug` fails while linking native code:

```
> Task :expo-modules-core:buildCMakeDebug[arm64-v8a] FAILED
C/C++: ninja: error: '.../react-native-worklets/android/build/intermediates/cmake/debug/obj/arm64-v8a/libworklets.so',
  needed by '.../libexpo-modules-core.so', missing and no known rule to make it
```

`react-native-reanimated` fails the same way for `libreanimated.so`.

**Whose bug it is:** **`expo-modules-core` and `react-native-reanimated`, not the
Acoustic Connect SDK.** Both hardcode the *legacy* AGP path for worklets'
native library:

```cmake
"${REACT_NATIVE_WORKLETS_DIR}/android/build/intermediates/cmake/${BUILD_TYPE}/obj/${ANDROID_ABI}/libworklets.so"
```

AGP 8 moved CMake objects to `build/intermediates/cxx/<BuildType>/<hash>/obj/<abi>/`,
so that directory is never populated. `libworklets.so` *is* built — it just lives
somewhere else, and the `<hash>` segment means no hardcoded path can reach it.

**The fix:** consume worklets through the prefab package that AGP already
generates. `react-native-worklets` sets `prefabPublishing true`, and AGP writes a
`react-native-workletsConfig.cmake` — carrying the correct `IMPORTED_LOCATION` —
into each consumer's `CMAKE_FIND_ROOT_PATH`. Both patches replace the hardcoded
path with `find_package(react-native-worklets REQUIRED CONFIG)`. This is the
mechanism `reanimated` already uses for `fbjni` and `ReactAndroid` in the same
CMakeLists, and the one worklets' own `fix-prefab.gradle` exists to enable.

**Why patch instead of upgrade:** `expo-modules-core@55.0.25` is the newest 55.x
and still carries the hardcoded path, so no version available to Expo SDK 55
fixes it. (`react-native-reanimated` has newer releases, but Expo SDK 55 pins
4.2.1, and bumping it alone would not fix `expo-modules-core`.)

**When to remove:** when this sample moves to an Expo SDK whose
`expo-modules-core` resolves worklets via prefab (or otherwise supports AGP 8
layouts), and to a `react-native-reanimated` that does the same. Verify by
deleting a patch, reinstalling, and running
`npx expo prebuild --platform android --clean && cd android && ./gradlew :app:assembleDebug`.

**To regenerate:**

```bash
# edit the two CMake files under node_modules, then:
npx patch-package expo-modules-core --include 'android/cmake/main\.cmake'
npx patch-package react-native-reanimated --include 'android/CMakeLists\.txt'
```

The `--include` flag matters: without it, `patch-package` also diffs Gradle/CMake
build output left in `node_modules` and produces multi-megabyte patches.
