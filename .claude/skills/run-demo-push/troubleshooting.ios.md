# iOS Troubleshooting — bare-workflow push (APNs + NSE/NCE)

Symptom → cause → fix, plus the exact diagnostic commands used to root-cause each.
All paths are relative to `Examples/bare-workflow/`.

## Quick reference

| Symptom | Cause | Fix |
|---|---|---|
| `npm run ios` builds but **no APNs token** (session reaches collector, no push messages) | CLI builds don't auto-pick a signing team like the Xcode GUI → `aps-environment` entitlement not embedded → OS issues no token (silent on Simulator) | Set `Connect.iOSDevelopmentTeam` in `ConnectConfig.json`, then `npx acoustic-connect setup-ios-push` stamps `DEVELOPMENT_TEAM` onto host + NSE + NCE. (Stamps the committed `project.pbxproj` — don't commit your personal Team ID.) |
| EAS build fails: **`Signing for "ConnectNCE"/"ConnectNSE" requires a development team`** | No signing team configured, so the Config Plugin's signing mod no-ops; since Xcode 14 the extension targets can't sign without a team | Set `Connect.iOSDevelopmentTeam` in `ConnectConfig.json` or the `iosDevelopmentTeam` plugin prop in `app.json` (committed → more robust for CI) before `eas build`. See `Examples/expo/README.md` → EAS Build |
| **Launch crash**, `EXC_BREAKPOINT` in `ConnectNotificationCenterProxy.installNotificationProxy()` | In automatic push mode the SDK owns the `UNUserNotificationCenter` delegate; the host also set it → the SDK's exclusive-ownership assert fires | Don't set the UNUC delegate in automatic mode. `AppDelegate.swift` already gates this on `configuredPushMode() == "manual"` — only a risk if you customize it |
| Long-press shows **no rich image** / NCE never renders; `EXC_BREAKPOINT` with "Unable to find NSExtensionContextClass (`_UNNotificationContentExtensionVendorContext`)" | The NCE target didn't link `UserNotificationsUI.framework` (declares the content-extension point) | `npx acoustic-connect setup-ios-push` (links UserNotificationsUI/UserNotifications/UIKit, idempotent) then `pod install` |
| **Collapsed-banner thumbnail missing** (but expanded image shows on long-press) | iOS **Simulator** doesn't render collapsed attachment thumbnails; the NCE expanded view works because it reads the image from the App Group container directly | Validate the thumbnail on a **physical device** — it is not a demo bug |
| `pod install` can't resolve `AcousticConnectDebug 2.x.x` | The version is on the CocoaPods git Specs repo before it propagates to the CDN | The Podfile lists the git Specs `source`; run `pod repo update` and retry |
| Xcode 26 build error: "call to consteval function is not a constant expression" in `fmt` | Apple-clang version guard in `fmt/base.h` | The Podfile `post_install` patches `fmt/base.h`; just ensure `pod install` actually ran |
| `INSTALL_FAILED_*` / code-sign/identity mismatch on install | Stale install signed by a different identity | Uninstall the app from the sim/device, reinstall |
| `xcrun simctl push` shows the banner but **no rich media** | `simctl` delivers locally and does **not** execute the NSE | Use a real APNs push (backend) to exercise the NSE |
| Image downloads fail / 0 attachments | The payload's image host is down (e.g. a 503) | Use a reliable image URL host; check `[NSE] Download failed — HTTP …` in the logs |

## Diagnostic commands

### Is the app getting a token? (registration)

```bash
# Does the app target resolve a signing team from the xcconfig chain?
xcodebuild -workspace ios/ConnectBareWorkflowDemo.xcworkspace \
  -scheme ConnectBareWorkflowDemo -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  -showBuildSettings 2>/dev/null | grep -E 'DEVELOPMENT_TEAM|CODE_SIGN_STYLE'

# Did the build embed aps-environment? (Simulator stores it in a *-Simulated.xcent)
find ~/Library/Developer/Xcode/DerivedData/ConnectBareWorkflowDemo-*/Build/Intermediates.noindex \
  -name 'ConnectBareWorkflowDemo.app-Simulated.xcent' -exec /usr/libexec/PlistBuddy -c Print {} \;

# Capture the SDK push logs on the booted simulator while sending a push:
xcrun simctl spawn booted log stream --level debug \
  --predicate 'process == "ConnectBareWorkflowDemo" OR process == "ConnectNSE" OR process == "ConnectNCE"'
```

Look for the `ConnectPushRegistrationMessage` flush and a `JSONOut` containing
`"type":22` with `"mobileToken"` and `"mobileProvider":"APN"`. That confirms
**registration** — if you then get no notification, it's a delivery/backend issue.

### NSE / NCE not running or crashing

```bash
# Stream only the extension processes; trigger a real push, then read:
xcrun simctl spawn booted log stream --level debug \
  --predicate 'process == "ConnectNSE" OR process == "ConnectNCE"'
```

Healthy NSE logs: `[NSE] didReceive`, `[NSE] Downloading largeIcon/expandedImage`,
`[NSE] … downloaded — N bytes`, `[NSE] Attachment created`, `[NSE] N attachment(s)
added — delivering enriched notification`. Healthy NCE: `[NCE] didReceive —
category: ACOUSTIC_RICH_NOTIFICATION, attachments: N`.

```bash
# NCE/NSE crash reports:
ls -t ~/Library/Logs/DiagnosticReports/Connect{NSE,NCE}*.ips 2>/dev/null

# Confirm the NCE actually links UserNotificationsUI (the crash cause if missing):
APP=$(xcrun simctl get_app_container booted \
  co.acoustic.mobile.connect.new.rn.demo.external.ConnectBareWorkflowDemo)
otool -L "$APP/PlugIns/ConnectNCE.appex/ConnectNCE" | grep -i UserNotificationsUI
```

A crash with "Unable to find NSExtensionContextClass" in `ExtensionFoundation`
means the framework link is missing — re-run `npx acoustic-connect setup-ios-push` + `pod install`.

### Entitlements / App Group

```bash
# What entitlements did the build actually embed?
codesign -d --entitlements :- --xml "$APP" 2>/dev/null
```

On a physical device the App Group must exist in your Apple Developer account; with
automatic signing + your team it is created from the `App Groups` capability already
declared in the `.entitlements` files — no manual portal step is normally needed.
