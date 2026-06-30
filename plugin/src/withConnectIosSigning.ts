// Copyright (C) 2026 Acoustic, L.P. All rights reserved.
//
// NOTICE: This file contains material that is confidential and proprietary to
// Acoustic, L.P. and/or other developers. No license is granted under any
// intellectual or industrial property rights of Acoustic, L.P. except as may
// be provided in an agreement with Acoustic, L.P. Any unauthorized copying or
// distribution of content from this file is prohibited.

import { withXcodeProject, type ConfigPlugin } from '@expo/config-plugins'
import type { ExpoConfig } from '@expo/config-types'
import * as fs from 'fs'
import * as path from 'path'

import type { ConnectPluginProps } from './withConnectNSE'

// Derive the xcode project type from the callback (the `xcode` package ships no
// types of its own) — same approach as withConnectNSE.
type XcodeProject = Parameters<
  Parameters<typeof withXcodeProject>[1]
>[0]['modResults']

const PLACEHOLDER_TEAM = 'YOUR_TEAM_ID'

/**
 * Resolves the iOS signing team (Apple Team ID) for the host + push extensions.
 *
 * Priority:
 *  1. `iosDevelopmentTeam` plugin prop in app.json (explicit override)
 *  2. `Connect.iOSDevelopmentTeam` in `<projectRoot>/ConnectConfig.json`
 *
 * Returns `undefined` when neither source provides a real value (the placeholder
 * `YOUR_TEAM_ID` counts as unset). The mod is then a no-op — never a regression.
 */
export function resolveDevelopmentTeam(
  projectRoot: string,
  props: ConnectPluginProps
): string | undefined {
  const fromProp = props.iosDevelopmentTeam?.trim()
  if (fromProp && fromProp !== PLACEHOLDER_TEAM) return fromProp

  const configPath = path.join(projectRoot, 'ConnectConfig.json')
  if (fs.existsSync(configPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
        Connect?: { iOSDevelopmentTeam?: unknown }
      }
      const team = parsed.Connect?.iOSDevelopmentTeam
      if (typeof team === 'string' && team.trim() && team.trim() !== PLACEHOLDER_TEAM)
        return team.trim()
    } catch {
      // Malformed JSON is already surfaced by resolveAppGroupIdentifier (which
      // runs earlier in the NSE mod) — don't double-report here.
    }
  }
  return undefined
}

/**
 * Expo Config Plugin mod that stamps `DEVELOPMENT_TEAM` onto every target's
 * build configuration in the generated Xcode project (host + ConnectNSE +
 * ConnectNCE), so all three sign consistently.
 *
 * Why this matters: the NSE mod injects the `aps-environment` entitlement, but
 * a CLI build (`expo run:ios` / `xcodebuild`) with no signing team falls back
 * to ad-hoc signing (`CODE_SIGN_IDENTITY = -`), which DROPS that entitlement —
 * so the OS issues no APNs token and push silently fails (CA-144135 §6). Setting
 * the team closes that loop on the prebuild path the SDK owns. Provisioning
 * itself still needs the developer's Apple ID in Xcode and
 * `-allowProvisioningUpdates` on the build (documented in the README).
 *
 * No-op when no team is configured (no regression for consumers who sign in the
 * Xcode GUI or via EAS, which manages the whole chain itself).
 *
 * Must run AFTER withConnectNSE / withConnectNCE so the extension targets exist.
 */
export const withConnectIosSigning: ConfigPlugin<ConnectPluginProps> = (
  config,
  props = {}
) => {
  const projectRoot = config._internal?.projectRoot
  // withConnectNSE already throws an actionable error when projectRoot is
  // missing; here we simply skip so we never throw twice for the same cause.
  if (!projectRoot) return config

  const team = resolveDevelopmentTeam(projectRoot, props)
  if (!team) return config

  return withXcodeProject(config, (c) => {
    const xcodeProject: XcodeProject = c.modResults
    const configurations = xcodeProject.pbxXCBuildConfigurationSection() as Record<
      string,
      { buildSettings?: Record<string, string | undefined> }
    >
    // Set the team on every build configuration that has a buildSettings block
    // (host + both extensions). Project-level configs get it too, which is
    // harmless and ensures consistency across all targets.
    for (const key of Object.keys(configurations)) {
      const entry = configurations[key]
      if (entry && typeof entry === 'object' && entry.buildSettings) {
        entry.buildSettings.DEVELOPMENT_TEAM = team
      }
    }
    return c
  }) as ExpoConfig
}

export default withConnectIosSigning
