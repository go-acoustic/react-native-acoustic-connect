// Copyright (C) 2026 Acoustic, L.P. All rights reserved.
//
// NOTICE: This file contains material that is confidential and proprietary to
// Acoustic, L.P. and/or other developers. No license is granted under any
// intellectual or industrial property rights of Acoustic, L.P. except as may
// be provided in an agreement with Acoustic, L.P. Any unauthorized copying or
// distribution of content from this file is prohibited.

import {
  withXcodeProject,
  withDangerousMod,
  type ConfigPlugin,
} from '@expo/config-plugins'
import type { ExpoConfig } from '@expo/config-types'
import * as fs from 'fs'
import * as path from 'path'
import {
  resolveAppGroupIdentifier,
  substituteSwiftTemplate,
  getHostBuildSettingForConfig,
  buildConnectPodTargetBlock,
  withNSEEntitlements,
  type ConnectPluginProps,
} from './withConnectNSE'

// XcodeProject is declared in the `xcode` package which ships no TypeScript
// types of its own. We derive the type from the withXcodeProject callback
// so the compiler can still check our usage without requiring @types/xcode.
type XcodeProject = Parameters<
  Parameters<typeof withXcodeProject>[1]
>[0]['modResults']

// ─── Target / config constants ─────────────────────────────────────────────

const NSE_TARGET_NAME = 'ConnectNSE'
const NCE_TARGET_NAME = 'ConnectNCE'

// Configs belonging to either extension target must be skipped when mirroring
// host build settings. The NCE mod runs AFTER the NSE mod in the composition,
// so by the time this executes the pbxproj already carries ConnectNSE configs;
// without skipping both, the NCE could mirror the NSE target's settings rather
// than the host app's.
const EXTENSION_TARGET_NAMES = [NSE_TARGET_NAME, NCE_TARGET_NAME]

// ─── Plist helpers ────────────────────────────────────────────────────────────

/**
 * Generates the Info.plist content for the ConnectNCE target.
 *
 * The NSExtensionAttributes mirror the canonical bare-workflow reference
 * (Examples/bare-workflow/ios/ConnectNCE/Info.plist), which itself mirrors the
 * iOS-SDK NCE 1:1:
 *  - UNNotificationExtensionCategory: the category identifiers the Connect
 *    APNs payload routes rich-media notifications through. Must match the
 *    category the SDK/Collector sets — keep in sync with the iOS-SDK NCE.
 *  - UNNotificationExtensionDefaultContentHidden=false: keep the default
 *    system body alongside the custom content view.
 *  - UNNotificationExtensionInitialContentSizeRatio=1.0: start full-height;
 *    the SDK content controller resizes to fit the rendered media.
 *
 * RCTNewArchEnabled is intentionally omitted: the NCE links the Connect SDK
 * only — no React Native runtime is present in the extension process. (The
 * bare-workflow reference carries it as an Xcode-template leftover; the
 * plugin-generated target drops it, consistent with the NSE template.)
 */
export function buildNCEInfoPlist(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>CFBundleDevelopmentRegion</key>
\t<string>$(DEVELOPMENT_LANGUAGE)</string>
\t<key>CFBundleDisplayName</key>
\t<string>ConnectNCE</string>
\t<key>CFBundleExecutable</key>
\t<string>$(EXECUTABLE_NAME)</string>
\t<key>CFBundleIdentifier</key>
\t<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
\t<key>CFBundleInfoDictionaryVersion</key>
\t<string>6.0</string>
\t<key>CFBundleName</key>
\t<string>$(PRODUCT_NAME)</string>
\t<key>CFBundlePackageType</key>
\t<string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
\t<key>CFBundleShortVersionString</key>
\t<string>$(MARKETING_VERSION)</string>
\t<key>CFBundleVersion</key>
\t<string>$(CURRENT_PROJECT_VERSION)</string>
\t<key>NSExtension</key>
\t<dict>
\t\t<key>NSExtensionAttributes</key>
\t\t<dict>
\t\t\t<key>UNNotificationExtensionCategory</key>
\t\t\t<array>
\t\t\t\t<string>ACOUSTIC_RICH_NOTIFICATION</string>
\t\t\t\t<string>ACTIONABLE_NOTIFICATION</string>
\t\t\t</array>
\t\t\t<key>UNNotificationExtensionDefaultContentHidden</key>
\t\t\t<false/>
\t\t\t<key>UNNotificationExtensionInitialContentSizeRatio</key>
\t\t\t<real>1.0</real>
\t\t</dict>
\t\t<key>NSExtensionPointIdentifier</key>
\t\t<string>com.apple.usernotifications.content-extension</string>
\t\t<key>NSExtensionPrincipalClass</key>
\t\t<string>$(PRODUCT_MODULE_NAME).NotificationViewController</string>
\t</dict>
</dict>
</plist>
`
}

/** Generates the entitlements plist content for the ConnectNCE target. */
export function buildNCEEntitlements(appGroupIdentifier: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>com.apple.security.application-groups</key>
\t<array>
\t\t<string>${appGroupIdentifier}</string>
\t</array>
</dict>
</plist>
`
}

// ─── Podfile injection ────────────────────────────────────────────────────────

const PODFILE_MARKER =
  '# @generated ConnectNCE target (react-native-acoustic-connect)'

/**
 * Returns the Ruby snippet to inject into the Expo-generated Podfile for the
 * ConnectNCE target. Thin wrapper over the shared
 * {@link buildConnectPodTargetBlock} (single source of truth for the
 * AcousticConnect pod-resolution helper), parameterised with the NCE marker,
 * helper name, and target name.
 */
export function buildPodfileBlock(): string {
  return buildConnectPodTargetBlock(
    PODFILE_MARKER,
    'acoustic_connect_pod_nce',
    NCE_TARGET_NAME
  )
}

/**
 * Injects the ConnectNCE Podfile block into `podfileContent` if not already
 * present (idempotent, guarded by PODFILE_MARKER).
 */
export function injectPodfileBlock(podfileContent: string): string {
  if (podfileContent.includes(PODFILE_MARKER)) {
    return podfileContent
  }
  return podfileContent + buildPodfileBlock()
}

// ─── Xcode project mod ───────────────────────────────────────────────────────

/**
 * Adds the ConnectNCE Xcode target (app_extension) to the project.
 *
 * Sibling to withNSEXcodeProject; the only differences are the target name,
 * the Swift source file (NotificationViewController.swift), the NCE Info.plist
 * (content-extension NSExtension keys), and skipping BOTH extension targets'
 * configs when mirroring host build settings.
 *
 * Idempotent: if a target named ConnectNCE already exists, skips target
 * creation but still (re)writes the source files.
 */
export function withNCEXcodeProject(
  config: ExpoConfig,
  appGroupIdentifier: string,
  swiftContent: string
): ExpoConfig {
  return withXcodeProject(config, (c) => {
    const xcodeProject: XcodeProject = c.modResults

    // ios/ directory — modRequest.platformProjectRoot is the canonical
    // native project root. (xcodeProject.filepath points INSIDE the
    // .xcodeproj bundle, so deriving from it misplaces the files.)
    const iosDir = c.modRequest.platformProjectRoot
    const nceDir = path.join(iosDir, NCE_TARGET_NAME)

    // Always write / overwrite the source files (idempotent)
    fs.mkdirSync(nceDir, { recursive: true })

    fs.writeFileSync(
      path.join(nceDir, 'NotificationViewController.swift'),
      swiftContent,
      'utf8'
    )
    fs.writeFileSync(
      path.join(nceDir, 'Info.plist'),
      buildNCEInfoPlist(),
      'utf8'
    )
    fs.writeFileSync(
      path.join(nceDir, `${NCE_TARGET_NAME}.entitlements`),
      buildNCEEntitlements(appGroupIdentifier),
      'utf8'
    )

    // Idempotency check — skip if target already registered in the pbxproj.
    // Note: pbxTargetByName misses targets on a REPARSED project because the
    // xcode lib stores written names with literal quotes ('"ConnectNCE"'),
    // so compare quote-stripped names across the native-target section.
    const nativeTargets = xcodeProject.pbxNativeTargetSection() as Record<
      string,
      { name?: string } | string
    >
    const targetExists = Object.values(nativeTargets).some(
      (t) =>
        typeof t === 'object' &&
        typeof t.name === 'string' &&
        t.name.replace(/"/g, '') === NCE_TARGET_NAME
    )
    if (targetExists) {
      return c
    }

    // Derive the host bundle id — the NCE bundle id must be
    // `<hostBundleId>.ConnectNCE`. Fail fast rather than emit a placeholder
    // (a wrong bundle id breaks App Group pairing and App Store submission).
    const hostBundleId = c.ios?.bundleIdentifier as string | undefined
    if (!hostBundleId) {
      throw new Error(
        `[react-native-acoustic-connect] ios.bundleIdentifier is not set.\n\n` +
          `The ConnectNCE extension bundle id is derived as ` +
          `"<ios.bundleIdentifier>.ConnectNCE", so the host bundle id must be ` +
          `defined in app.json before prebuild:\n` +
          `       { "expo": { "ios": { "bundleIdentifier": "com.example.app" } } }`
      )
    }

    // Add the native target (app_extension)
    const nceTarget = xcodeProject.addTarget(
      NCE_TARGET_NAME,
      'app_extension',
      NCE_TARGET_NAME,
      `${hostBundleId}.ConnectNCE`
    )

    if (!nceTarget) {
      throw new Error(
        `[react-native-acoustic-connect] Failed to add ConnectNCE Xcode target.`
      )
    }

    // Add the build phase for Swift sources
    xcodeProject.addBuildPhase(
      ['NotificationViewController.swift'],
      'PBXSourcesBuildPhase',
      'Sources',
      nceTarget.uuid
    )

    // Add Resources build phase (empty, but required by Xcode)
    xcodeProject.addBuildPhase(
      [],
      'PBXResourcesBuildPhase',
      'Resources',
      nceTarget.uuid
    )

    // Add the Frameworks build phase, then explicitly link the two
    // user-notifications system frameworks into the NCE target.
    //
    // The NCE principal class conforms to `UNNotificationContentExtension`,
    // whose extension-point context class
    // (`_UNNotificationContentExtensionVendorContext`) is vended by
    // UserNotificationsUI.framework, and whose `didReceive(_:)` consumes
    // `UNNotification` / `UNNotificationContent` from UserNotifications.framework.
    // Without these explicit links the extension binary never loads them, so on
    // a PHYSICAL DEVICE iOS logs "Unable to find NSExtensionContextClass … did
    // you link the framework that declares the extension point?" and never calls
    // `didReceive(_:)`. The custom expanded view (rich-media `expandedImage`)
    // then silently never renders, while the NSE-produced thumbnail still shows.
    // The iOS Simulator resolves these classes implicitly, masking the omission —
    // so this only surfaces on device. Both are Apple SYSTEM frameworks, so
    // CocoaPods does NOT add them; they must be linked here, mirroring the
    // canonical Examples/bare-workflow ConnectNCE target (which also lists the
    // auto-linked Foundation/UIKit — omitted here as Swift links them implicitly).
    xcodeProject.addBuildPhase(
      [],
      'PBXFrameworksBuildPhase',
      'Frameworks',
      nceTarget.uuid
    )
    xcodeProject.addFramework(
      'System/Library/Frameworks/UserNotifications.framework',
      { target: nceTarget.uuid }
    )
    xcodeProject.addFramework(
      'System/Library/Frameworks/UserNotificationsUI.framework',
      { target: nceTarget.uuid }
    )

    // Make the host app target depend on ConnectNCE. CocoaPods resolves an
    // extension's host target through PBXTargetDependency
    // (xcodeproj's host_targets_for_embedded_target), NOT through the embed
    // copy phase — without this edge `pod install` fails with "Unable to find
    // host target(s) for ConnectNCE".
    // The xcode lib SILENTLY no-ops addTargetDependency when these sections
    // are absent from the parsed project — create them first. (The NSE mod
    // already creates them when it runs before this; guarding here keeps the
    // NCE mod correct if it ever runs first.)
    const objects = xcodeProject.hash.project.objects
    objects['PBXTargetDependency'] = objects['PBXTargetDependency'] ?? {}
    objects['PBXContainerItemProxy'] = objects['PBXContainerItemProxy'] ?? {}
    const hostTargetUuid = xcodeProject.getFirstTarget().uuid
    xcodeProject.addTargetDependency(hostTargetUuid, [nceTarget.uuid])

    // Create a PBXGroup for ConnectNCE source files
    const nceGroup = xcodeProject.addPbxGroup(
      [
        'NotificationViewController.swift',
        'Info.plist',
        `${NCE_TARGET_NAME}.entitlements`,
      ],
      NCE_TARGET_NAME,
      NCE_TARGET_NAME
    )

    // Add the group to the main project group
    const mainGroup = xcodeProject.getFirstProject().firstProject.mainGroup
    xcodeProject.addToPbxGroup(nceGroup.uuid, mainGroup)

    // Set per-configuration build settings — mirror each host configuration
    // individually so Debug gets Debug values and Release gets Release values.
    const buildConfigurations = xcodeProject.pbxXCConfigurationList()
    const nceConfigListUuid = nceTarget.pbxNativeTarget.buildConfigurationList

    if (nceConfigListUuid) {
      const configList = buildConfigurations[nceConfigListUuid]
      if (
        configList &&
        Array.isArray(
          (configList as { buildConfigurations?: unknown[] })
            .buildConfigurations
        )
      ) {
        const configs = xcodeProject.pbxXCBuildConfigurationSection()
        for (const entry of (
          configList as { buildConfigurations: Array<{ value: string }> }
        ).buildConfigurations) {
          const buildConfig = configs[entry.value]
          if (buildConfig && buildConfig.buildSettings) {
            // Determine which host config name to mirror (Debug → Debug, etc.)
            const configName: string =
              (buildConfig as { name?: string }).name ?? 'Debug'

            // Mirror per-configuration values; fall back to the other config's
            // value only when the matching one is absent. Skip BOTH extension
            // targets so the NCE never mirrors the NSE target's settings.
            const deploymentTarget = getHostBuildSettingForConfig(
              xcodeProject,
              'IPHONEOS_DEPLOYMENT_TARGET',
              configName,
              // Matches the AcousticConnect podspec floor (iOS >= 15.1) so the
              // NCE never demands a higher minimum than the host app.
              '15.1',
              EXTENSION_TARGET_NAMES
            )
            const swiftVersion = getHostBuildSettingForConfig(
              xcodeProject,
              'SWIFT_VERSION',
              configName,
              '5.0',
              EXTENSION_TARGET_NAMES
            )
            const marketingVersion = getHostBuildSettingForConfig(
              xcodeProject,
              'MARKETING_VERSION',
              configName,
              '1.0',
              EXTENSION_TARGET_NAMES
            )
            const currentProjectVersion = getHostBuildSettingForConfig(
              xcodeProject,
              'CURRENT_PROJECT_VERSION',
              configName,
              '1',
              EXTENSION_TARGET_NAMES
            )

            Object.assign(buildConfig.buildSettings, {
              // Prevent Xcode from synthesising a second Info.plist that would
              // shadow the NSExtension dictionary in ours.
              GENERATE_INFOPLIST_FILE: 'NO',
              INFOPLIST_FILE: `${NCE_TARGET_NAME}/Info.plist`,
              // Extension must target the device SDK and restrict to
              // extension-safe APIs (mirrors bare-workflow reference target).
              SDKROOT: 'iphoneos',
              APPLICATION_EXTENSION_API_ONLY: 'YES',
              IPHONEOS_DEPLOYMENT_TARGET: deploymentTarget,
              SWIFT_VERSION: swiftVersion,
              MARKETING_VERSION: marketingVersion,
              CURRENT_PROJECT_VERSION: currentProjectVersion,
              CODE_SIGN_ENTITLEMENTS: `${NCE_TARGET_NAME}/${NCE_TARGET_NAME}.entitlements`,
              PRODUCT_NAME: NCE_TARGET_NAME,
              PRODUCT_BUNDLE_IDENTIFIER: `${hostBundleId}.ConnectNCE`,
              TARGETED_DEVICE_FAMILY: '"1,2"',
              CODE_SIGN_STYLE: 'Automatic',
            })
          }
        }
      }
    }

    return c
  })
}

// ─── Podfile mod ─────────────────────────────────────────────────────────────

/**
 * Injects the ConnectNCE Podfile target block via withDangerousMod.
 * Guarded by a marker comment — re-runs are no-ops.
 *
 * Throws a clear, actionable error when the Podfile does not exist at
 * mod-execution time, instead of silently returning — a silent skip would
 * ship an NCE whose `import Connect` cannot resolve.
 */
export function withNCEPodfile(config: ExpoConfig): ExpoConfig {
  return withDangerousMod(config, [
    'ios',
    async (c) => {
      const podfilePath = path.join(c.modRequest.platformProjectRoot, 'Podfile')
      if (!fs.existsSync(podfilePath)) {
        throw new Error(
          `[react-native-acoustic-connect] ios/Podfile not found at ${podfilePath}.\n\n` +
            `This mod runs after prebuild generates the ios/ directory. ` +
            `If you are running this plugin outside of \`expo prebuild\`, ` +
            `ensure the Podfile exists before the dangerous mod phase executes.\n` +
            `Check prebuild ordering: withDangerousMod('ios') runs after ` +
            `withXcodeProject, so the ios/ directory should already be present.`
        )
      }
      const current = fs.readFileSync(podfilePath, 'utf8')
      const updated = injectPodfileBlock(current)
      if (updated !== current) {
        fs.writeFileSync(podfilePath, updated, 'utf8')
      }
      return c
    },
  ])
}

// ─── Composed mod ─────────────────────────────────────────────────────────────

/**
 * Expo Config Plugin mod that provisions a Notification Content Extension
 * (NCE) Xcode target named `ConnectNCE`.
 *
 * Applies three mutations — all idempotent:
 *  1. Host app entitlements: merges App Group into
 *     `com.apple.security.application-groups` (reuses the NSE host-entitlements
 *     mod — the host shares one App Group across app + NSE + NCE; the merge is
 *     a no-op when the NSE mod already added it).
 *  2. Xcode project: adds ConnectNCE target + files (skips if already present).
 *  3. Podfile: injects `target 'ConnectNCE'` block (guarded by marker comment).
 *
 * `config._internal.projectRoot` is required (injected by Expo CLI during
 * `expo prebuild`); an actionable error is thrown if absent rather than
 * silently falling back to `process.cwd()`.
 *
 * NSE coupling (intentional, tracked for refactor): this mod deliberately
 * reuses three pieces of withConnectNSE — `withNSEEntitlements` (the host App
 * Group is shared across app + NSE + NCE), `buildConnectPodTargetBlock` (one
 * source for the pod-resolution helper), and `getHostBuildSettingForConfig`
 * (the per-config mirroring logic). The composition always runs withConnectNSE
 * before withConnectNCE, so the shared host entitlement and the
 * PBXTargetDependency/PBXContainerItemProxy sections already exist when this
 * runs. Extracting a shared `withConnectExtension` base for NSE + NCE is
 * tracked as a follow-up refactor (see PR description) rather than done here,
 * to keep the already-landed NSE mod stable.
 */
export const withConnectNCE: ConfigPlugin<ConnectPluginProps> = (
  config,
  props = {}
) => {
  const projectRoot = config._internal?.projectRoot
  if (!projectRoot) {
    throw new Error(
      `[react-native-acoustic-connect] config._internal.projectRoot is not set.\n\n` +
        `This value is injected by Expo CLI during \`expo prebuild\`. ` +
        `If you are calling this plugin outside of Expo CLI (e.g. in a test or ` +
        `custom script), set config._internal = { projectRoot: '/abs/path/to/project' } ` +
        `before invoking the plugin.`
    )
  }

  const appGroupIdentifier = resolveAppGroupIdentifier(projectRoot, props)

  const swiftTemplatePath = path.join(
    __dirname,
    '..',
    'swift',
    'NotificationViewController.swift'
  )
  const swiftContent = substituteSwiftTemplate(
    swiftTemplatePath,
    appGroupIdentifier
  )

  let result = withNSEEntitlements(config, appGroupIdentifier)
  result = withNCEXcodeProject(result, appGroupIdentifier, swiftContent)
  result = withNCEPodfile(result)
  return result
}
