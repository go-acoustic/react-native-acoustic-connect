# Examples/shared — cross-sample UI

Framework-agnostic UI shared by the two demo apps so they stay **identical**:

- [`../bare-workflow`](../bare-workflow) — manual native setup (classic RN +
  react-navigation).
- [`../expo`](../expo) — Expo SDK 55+ dev build (expo-router).

Both import this source via the `@shared/*` path alias. Only the navigation
chrome differs per app; everything here (screens, components, services, theme)
is consumed verbatim by both — there is no forked copy to keep in sync.

```
theme/       brand colors (mirror the iOS sample asset catalog)
components/  LogoHeader, buttons, DemoCard, StatusRow, DemoTextField
services/    ConnectSDKManager (SDK wrapper), pushPermission, useManagerState
screens/     PushScreen, IdentityScreen, BehaviourScreen
```

These files depend only on `react`, `react-native`,
`react-native-acoustic-connect-beta`, and
`@react-native-async-storage/async-storage` — no navigation-framework imports —
so each app resolves them against its own dependency copies.

## How `@shared` resolves

| Context | Location | Wiring |
|---|---|---|
| Monorepo (both apps, in-tree) | `../shared` (this dir, a sibling) | `tsconfig.json` `paths` + Metro `extraNodeModules` in each app |
| Published / CI standalone `bare-workflow` | `./shared` (vendored subdir) | `Jenkinsfile` `publishSampleApp` / `prepareSampleHost` `git archive` this dir into the standalone app; the standalone Metro config aliases `@shared` → `./shared` |

The standalone published sample must be self-contained (only
`Examples/bare-workflow` is shipped to the public repo), so the pipeline
vendors this directory into it at build time rather than relying on the sibling.

> When the Expo sample gains its own standalone publish path (CA-143485), that
> pipeline must vendor this directory the same way.
