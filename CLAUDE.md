# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

React Native plugin for Acoustic Connect SDK (beta). Captures user interactions, screen replays, and analytics events on iOS and Android. Uses **Nitro Modules** (not the legacy RN bridge) for native communication.

- **Package**: `react-native-acoustic-connect` (npm)
- **Public release repo**: `go-acoustic/react-native-acoustic-connect` (auto-generated from this beta repo via Jenkins)
- **Requirements**: React Native 0.82.x – 0.85.x (new architecture only), React >= 19.1.1, Node >= 20. **Expo SDK 55+ supported** via the bundled Expo Config Plugin (`app.plugin.js` + `plugin/`) — development builds only; Expo Go is not supported (no runtime detection or fallback).
- **Note on React floor**: RN itself declares the React minimum per release (RN 0.82 → React 19.1.1, RN 0.85 → React 19.2.3). Our peer states what *this* SDK needs (19.1.1+); npm composes our constraint with RN's, so consumers see RN's per-version warning if they pair a newer RN with an older React.
- **Tested against**: RN 0.82.x. Per-version verification on RN 0.83 / 0.84 / 0.85 is tracked alongside the v19.x release work.

## Compatibility Constraints

- `react-native-nitro-modules` is pinned to an **exact version** (currently `0.35.9`) in `peerDependencies` **and** `devDependencies`, and that version **must equal** the `nitrogen` version that generated `nitrogen/generated/`. **Do not loosen this to a range (`^`, `~`, or `>=…<…`).**
  - **Why exact, not a range — Nitro patch versions CAN be breaking.** The committed native bindings are tightly coupled to the Nitro runtime, and the coupling is *not* patch-safe. A **patch** bump `0.35.4`→`0.35.9` changed the generated Android HybridObject impl-class descriptor (`com/margelo/nitro/acousticconnectrn/…` → `com/acousticconnectrn/…`); against a mismatched runtime, `createHybridObject('AcousticConnectRN')` throws `ClassNotFoundException` and the whole SDK fails to instantiate (every method undefined). A range peer therefore *cannot* guarantee a client app won't break. (Earlier, Nitro `0.35.0` also removed `AnyMapHolder.hpp`, breaking `0.34.x` consumers — same class of problem.) See [CA-137698](https://acoustic-jiraconf.atlassian.net/browse/CA-137698) and [CA-138631](https://acoustic-jiraconf.atlassian.net/browse/CA-138631).
  - **Lockstep rule when bumping Nitro:** bump `nitrogen` + `react-native-nitro-modules` (dev **and** peer) to the *same* exact version, run `npm run codegen`, commit the regenerated `nitrogen/generated/`, and verify `example/` **and** `bare-workflow` boot on an emulator (a compile check does NOT catch this — the failure is at runtime). Never bump the runtime without regenerating; never regenerate without bumping the peer.
  - Clients must resolve exactly this version. If they bypass the peer (`--legacy-peer-deps`/`--force`) they own the compatibility risk — we cannot guard against breaking changes in arbitrary future Nitro patches. `src/index.ts` wraps `createHybridObject` to surface a clear, actionable error (instead of an opaque `ClassNotFoundException`) when the native module fails to load.
- `Connect.tsx` reads `child.props.ref` before falling back to `child.ref`. Reason: React 19 moved the ref from `element.ref` onto `element.props.ref`. The fallback is a defensive guard from the React 18 era — kept rather than removed to avoid a behavioural change. See [CA-138631](https://acoustic-jiraconf.atlassian.net/browse/CA-138631).

## Build Commands

```bash
npm run build          # TypeScript typecheck + bob build (outputs to lib/)
npm run typecheck      # TypeScript check only
npm run codegen        # Regenerate Nitro native bindings + build
npm run rebuild        # codegen + rebuild example app (full native rebuild)
npm run yalcPublish    # rebuild + publish to local yalc for testing
```

There are **no automated tests** configured (`npm test` exits with error). Example apps serve as manual test platforms.

## Adding a New Native API

1. Add the method signature to [react-native-acoustic-connect.nitro.ts](src/specs/react-native-acoustic-connect.nitro.ts) (TypeScript interface)
2. Run `npm run rebuild` -- this regenerates C++/Swift/Kotlin bindings in `nitrogen/generated/`
3. Implement the method in:
   - iOS: [HybridAcousticConnectRN.swift](ios/HybridAcousticConnectRN.swift)
   - Android: [HybridAcousticConnectRN.kt](android/src/main/java/com/acousticconnectrn/HybridAcousticConnectRN.kt)
4. Export from [src/index.ts](src/index.ts) if it's a new public API

## Architecture

```
TypeScript API (src/) --> Nitro HybridObject --> Native SDK (Swift/Kotlin)
```

**Key layers:**

- **Nitro spec** (`src/specs/`): The single source of truth for the JS-to-native interface. `nitro-codegen` generates C++, Swift, and Kotlin bridge code into `nitrogen/generated/` -- never edit those files directly.
- **TLTRN** (`src/TLTRN.ts`): Core logging wrapper. Bridges JS events to native, handles JS bridge spying via `MessageQueue.spy()`, global error handling via `ErrorUtils.setGlobalHandler()`.
- **Connect component** (`src/components/Connect.tsx`): React wrapper around `NavigationContainer`. Captures navigation state changes (screen views), click events via `onStartShouldSetResponderCapture`, and optionally keyboard events.
- **Dialog tracking** (`src/utils/DialogListener.ts`): Intercepts `Alert.alert()` calls automatically. Also available as `useDialogTracking` hook and `withAcousticAutoDialog` HOC for custom dialogs.
- **Native implementations**: iOS uses `Connect` + `EOCore` frameworks. Android uses `Connect` framework with lifecycle listener on the React context.

## Local Testing with yalc

```bash
npm i yalc -g           # one-time install
npm run yalcPublish     # build + publish locally
# In your test app:
yalc add react-native-acoustic-connect
```

Example apps in `Examples/` with `_yalc` suffix are pre-configured for local linking.

## Workspace example apps

Two RN apps live as npm workspaces of this repo (declared in the root
`package.json`'s `workspaces` array):

| Path | Purpose |
|---|---|
| `example/` | Original SDK dev harness — used for in-tree development of the SDK itself. |
| `Examples/bare-workflow/` | Bare-workflow sample app (CA-144313). Doubles as the public-facing support reference and the test-automation target. Published to `go-acoustic/react-native-acoustic-connect`'s `next` branch by the `Publish Sample App` stage of the `Jenkinsfile`. |

### Bare-workflow must stay in sync and always build

`Examples/bare-workflow/` is the **official partner-facing sample and the
test-automation target**, so it must build and run at all times. Apply every
SDK package change to bare-workflow in the **same change set** and verify it
builds — never leave it behind:

- **Podspec SDK-floor / version bumps** → update `Examples/bare-workflow/ios/Podfile`
  sources to match (e.g. add the CocoaPods git Specs `source` when a new
  `AcousticConnectDebug` version is on git but not yet propagated to the CDN)
  and re-run `pod install` in `Examples/bare-workflow/ios`.
- **Nitro spec / native bridge API changes** → confirm bare-workflow still
  compiles against the regenerated spec.
- **`ConnectConfig.json` / native project changes** → mirror into bare-workflow.

A broken bare-workflow blocks partners and CI test automation.

### How the workspace consumes the SDK

- The SDK declares `"react-native": "src/index"` in its `package.json`,
  so Metro resolves `import 'react-native-acoustic-connect'`
  directly to the SDK's TypeScript source. No `lib/` build is needed
  during dev.
- Both apps reference the SDK by its declared version
  (`"react-native-acoustic-connect": "18.0.23"`) — npm workspaces
  symlinks the local SDK package over that, so the in-tree code is
  what's actually consumed.
- React, React Native, Nitro, and other peer deps are hoisted to the
  single root `node_modules/`. The repo's devDeps pin them to versions
  compatible with all workspace members (currently React 19.1.1 + RN
  0.82.1) so npm hoists them cleanly rather than nesting copies. If
  you bump RN here, bump it in `package.json` `devDependencies` too so
  workspace hoisting stays clean.
- One `npm install` at the repo root sets up everything; per-app
  installs are not needed.

### Bare-workflow native folders are committed

`Examples/bare-workflow/{ios,android}/` are committed to this repo (with
the usual generated/derived bits ignored — see the demo's `.gitignore`).
This gives test automation and CI a deterministic native scaffold and
lets external users clone the published sample and run it without
scaffolding themselves.

### Bare-workflow uses Node-resolved gradle paths

The Android build files in `Examples/bare-workflow/android/` do **not**
hard-code `node_modules` paths. Both `settings.gradle` (for
`@react-native/gradle-plugin`) and `app/build.gradle` (for
`react-native` + `@react-native/codegen`) resolve their paths at gradle
config time via:

```groovy
["node", "-p", "require.resolve('<package>/package.json')"]
    .execute([], <baseDir>).text.trim()
```

Node's `require.resolve` walks up `node_modules` from the cwd and finds
the right copy regardless of layout. The same committed files work in
both contexts:

  - Workspace dev — packages hoisted to `<sdk-root>/node_modules/`.
  - Standalone (published `next` branch) — packages in the app's own
    `node_modules/`.

No path overrides need re-applying after RN bumps or rescaffolds. The
Jenkinsfile's `Publish Sample App` stage publishes these files as-is
(no `sed` rewriting).

iOS is already monorepo-friendly out of the box — the bare-workflow
Podfile uses Node-driven resolution in the same spirit, inherited from
the standard RN 0.82 template.

### iOS `REACT_NATIVE_PATH` in pbxproj is *pod-install-owned*

Reviewers occasionally flag `REACT_NATIVE_PATH = "${PODS_ROOT}/../../../../node_modules/react-native"` in the committed pbxproj as "wrong for standalone (the depth is workspace-specific)". That concern is moot.

`pod install` writes this build setting **directly into the
pbxproj** (not the xcconfig — `grep REACT_NATIVE_PATH` on
`Pods-*.debug.xcconfig` returns nothing) and **recomputes the depth
per environment**:

  - In our workspace: 4 levels up → `<sdk-root>/node_modules/react-native`.
  - In a customer's standalone clone of the published sample: 2 levels
    up → `<app>/node_modules/react-native`.

So the committed value is just a snapshot of whichever environment
last ran `pod install`. Build correctness depends on `pod install`
running before `xcodebuild` (it must — there's no Pods/ directory
otherwise), at which point the value is rewritten correctly.

Don't try to "fix" this by deleting the line — pod install puts it
back on the next run.

### ConnectConfig.json placement

Each workspace member holds its own gitignored `ConnectConfig.json` next
to its `android/`/`ios/` folders — the SDK's `config.gradle` and
podspec's `applyConfiguration` step both resolve `../ConnectConfig.json`
from the consumer's `android/` directory. The committed
`ConnectConfig.example.json` is the template; copy + edit to your QA or
local collector when first running the demo.

## CI/CD

- **Jenkins** (`Jenkinsfile`): Builds Nitro module, iOS (Xcode), Android (Gradle), runs the sample-build CI gates, bumps version, generates CHANGELOG.md, publishes beta. Runs on `feature/*`, `develop`, `main`.
- **GitHub Actions** (`.github/workflows/publish.yml`): Publishes to npm via Trusted Publishers (OIDC) when a version tag is pushed. Jenkins triggers this by pushing tags (bare semver, e.g. `19.0.1` — no `v` prefix).
- Beta publishes from `develop` branch, gated on the `ios-sample-build-success` + `android-sample-build-success` CI gates (develop-only stages). Release publishes from `main` by transforming the beta package (renaming `react-native-acoustic-connect` to `react-native-acoustic-connect`) — gated transitively, since it only republishes versions that passed the gates as betas — and is followed by a post-publish install smoke (`npm-package-install-success`). Gate failures alert `#sdk-ci-react-native-bender`.
- See [RELEASE.md](RELEASE.md) for the full release process, versioning convention (always-bump-patch), and the broken-publish forward-fix runbook.

## JIRA Workflow

When working on a JIRA ticket (CA-XXXXXX), use the `/implementation` skill. It handles the full lifecycle: ticket fetch, worktree creation, investigation, implementation, validation, and PR creation. Key points:

- Always work in a git worktree (`feature/CA-XXXXXX` branch off `develop`)
- Validate with `.claude/skills/implementation/validate.sh` (typecheck + build)
- Create PRs with `.claude/skills/implementation/create-pr.sh CA-XXXXXX "description"`
- JIRA board: [board 916](https://acoustic-jiraconf.atlassian.net/jira/software/c/projects/CA/boards/916)

## Code Style

- Prettier: single quotes, 2-space indent, trailing commas (es5), no semicolons, no tabs
- ESLint: `@react-native` + `prettier` configs
- Commit messages follow conventional commits (`feat:`, `fix:`, `chore:`, etc.)
