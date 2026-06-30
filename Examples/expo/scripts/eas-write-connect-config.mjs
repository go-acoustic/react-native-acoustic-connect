// Copyright (C) 2026 Acoustic, L.P. All rights reserved.
//
// Materializes Examples/expo/ConnectConfig.json during an EAS build.
//
// Why this exists:
//   ConnectConfig.json is gitignored (it holds an app key + collector URL),
//   so it is absent in the EAS cloud checkout. The iOS podspec reads that file
//   at `pod install` time and bakes AppKey / PostMessageUrl / KillSwitchUrl into
//   the AcousticConnectRNConfig resource bundle. With no file, pod install fails.
//
// This script runs from the `eas-build-pre-install` hook (before pod install)
// and writes the config from EAS environment variables / secrets.
//
// Resolution order:
//   1. CONNECT_CONFIG_JSON  — full ConnectConfig.json contents (verbatim).
//   2. CONNECT_APP_KEY      — app key; the two collector URLs are derived from
//      CONNECT_COLLECTOR_URL (the PostMessageUrl; defaults to the QA collector).
//   3. An existing on-disk ConnectConfig.json (local dev) is left untouched.
//   4. Otherwise: hard error with setup instructions (covers EAS-without-secret
//      and fresh clones) so the build fails loudly instead of shipping a broken
//      demo.

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync, writeFileSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const appRoot = join(here, '..')
const configPath = join(appRoot, 'ConnectConfig.json')

// Non-secret structural defaults for this demo app. Only AppKey and the two
// collector URLs are environment-driven; everything else (App Group, push mode,
// notification icon) is fixed for the sample and must NOT fall back to the
// example template's placeholders (that would break iOS push).
const DEFAULTS = {
  AndroidVersion: '',
  PushEnabled: true,
  iOSPushMode: 'automatic',
  iOSAppGroupIdentifier: 'group.co.acoustic.mobile.connect.rn.expodemo',
  AndroidNotificationIconResName: 'ic_notification',
  iOSVersion: '',
  useRelease: false,
}

const {
  CONNECT_CONFIG_JSON,
  CONNECT_APP_KEY,
  CONNECT_COLLECTOR_URL = 'https://collector-eaoc.qa.goacoustic.com/collector/collectorPost',
  CONNECT_IOS_APP_GROUP,
  EAS_BUILD,
} = process.env

function write(config) {
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n')
}

// 1. Full-JSON override.
if (CONNECT_CONFIG_JSON) {
  let parsed
  try {
    parsed = JSON.parse(CONNECT_CONFIG_JSON)
  } catch (err) {
    console.error(
      '[connect-config] CONNECT_CONFIG_JSON is set but is not valid JSON:',
      err.message
    )
    process.exit(1)
  }
  write(parsed)
  console.log('[connect-config] wrote ConnectConfig.json from CONNECT_CONFIG_JSON')
  process.exit(0)
}

// 2. Build from the app key + collector URL over the fixed structural defaults.
if (CONNECT_APP_KEY) {
  // PostMessageUrl: .../collector/collectorPost
  // KillSwitchUrl:  .../collector/switch/<appKey>  (same base, swap the leaf)
  const base = CONNECT_COLLECTOR_URL.replace(/\/collectorPost\/?$/, '')
  write({
    Connect: {
      AndroidVersion: DEFAULTS.AndroidVersion,
      AppKey: CONNECT_APP_KEY,
      KillSwitchUrl: `${base}/switch/${CONNECT_APP_KEY}`,
      PostMessageUrl: CONNECT_COLLECTOR_URL,
      PushEnabled: DEFAULTS.PushEnabled,
      iOSPushMode: DEFAULTS.iOSPushMode,
      iOSAppGroupIdentifier: CONNECT_IOS_APP_GROUP || DEFAULTS.iOSAppGroupIdentifier,
      AndroidNotificationIconResName: DEFAULTS.AndroidNotificationIconResName,
      iOSVersion: DEFAULTS.iOSVersion,
      useRelease: DEFAULTS.useRelease,
    },
  })
  console.log(
    '[connect-config] wrote ConnectConfig.json from CONNECT_APP_KEY + CONNECT_COLLECTOR_URL'
  )
  process.exit(0)
}

// 3. Local dev: keep whatever the developer already created.
if (existsSync(configPath)) {
  console.log('[connect-config] existing ConnectConfig.json found; leaving it untouched')
  process.exit(0)
}

// 4. No config and no env vars — fail with instructions.
console.error(
  [
    '[connect-config] No ConnectConfig.json and no config env vars set.',
    '',
    'Set one of these in your EAS build profile env (eas.json) or as an EAS secret:',
    '  - CONNECT_APP_KEY        (recommended) e.g. 72a8ed52471540c59dbbfe9e0f8bca1d',
    '  - CONNECT_COLLECTOR_URL  (optional) defaults to the QA collector',
    '  - CONNECT_IOS_APP_GROUP  (optional) iOS push App Group identifier',
    'or:',
    '  - CONNECT_CONFIG_JSON    full ConnectConfig.json contents',
    '',
    EAS_BUILD === 'true'
      ? 'Running under EAS — failing the build.'
      : 'For local builds, copy ConnectConfig.example.json to ConnectConfig.json and edit it.',
  ].join('\n')
)
process.exit(1)
