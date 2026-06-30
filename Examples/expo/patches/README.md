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
