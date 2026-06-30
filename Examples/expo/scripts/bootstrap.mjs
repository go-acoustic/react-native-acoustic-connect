#!/usr/bin/env node
// Examples/expo bootstrap — thin wrapper over the SDK's shared setup CLI.
//
// The config validation + ConnectConfig.json scaffolding that used to live here
// now ships in the SDK package (`acoustic-connect doctor`), so every consumer
// gets the same checks. This wrapper just runs the doctor against this app,
// installs JS dependencies, and prints the Expo-specific next steps.
//
//   npm run bootstrap
//   node scripts/bootstrap.mjs --skip-install
//
// It does NOT run pod install / device installs (Expo `prebuild`/`run:*` own
// that) or create Apple/Firebase resources (manual, account-specific).

import {existsSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Locate the SDK's bundled CLI. In-repo (workspace / file: link) it sits two
// levels up; in a standalone published clone it's under node_modules.
function findCliDir() {
  const candidates = [
    path.resolve(appDir, '..', '..', 'cli'),
    path.resolve(appDir, 'node_modules', 'react-native-acoustic-connect', 'cli'),
  ]
  return candidates.find((p) => existsSync(path.join(p, 'index.mjs')))
}

const cliDir = findCliDir()
if (!cliDir) {
  console.error(
    'Could not locate the react-native-acoustic-connect CLI. Run `npm install` first.',
  )
  process.exit(1)
}

const {color, info, run, section} = await import(
  pathToFileURL(path.join(cliDir, 'lib.mjs'))
)
const cli = path.join(cliDir, 'index.mjs')

const skipInstall = process.argv.includes('--skip-install')

console.log(color.bold('\nExamples/expo bootstrap'))

// 1. Doctor: validate config + scaffold ConnectConfig.json. Non-zero exit means
//    something needs the developer's attention, but we still install so the app
//    is otherwise ready — the doctor summary already explains what to fix.
const doctorOk = run(`node "${cli}" doctor "${appDir}"`)

// 2. Install JS dependencies. Examples/expo is not a workspace member — it
//    installs its own node_modules and consumes the SDK via the file:../.. link.
if (skipInstall) {
  section('Install')
  info('npm install skipped (--skip-install)')
} else {
  section('Installing JS dependencies')
  info(appDir)
  if (!run('npm install', {cwd: appDir}))
    console.log(color.red(`  npm install failed in ${appDir}`))
}

const isMac = process.platform === 'darwin'
section('Next steps')
for (const s of [
  'Set your own ids in app.json: ios.bundleIdentifier + android.package (they ship as com.example.* placeholders)',
  'Fill in ConnectConfig.json (AppKey + collector URLs; for push also iOSAppGroupIdentifier + iOSDevelopmentTeam)',
  'Create the App Group on the Apple Developer portal + enable it on the host + ConnectNSE + ConnectNCE App IDs',
  'EAS builds: run `eas init` to attach your own EAS project (the sample ships no projectId/owner)',
  isMac ? 'iOS:      npx expo run:ios --device' : null,
  isMac
    ? 'If the install step crashes (Expo LockdowndClient bug): xcrun devicectl device install app --device <UDID> <built .app>, then npx expo start --dev-client'
    : null,
  'Android:  npx expo run:android',
  'Verify the collector: Console.app → Include Info Messages → filter subsystem com.acoustic.AcousticConnectRN',
  'See README "Troubleshooting" for the full gotcha list',
].filter(Boolean))
  info(`• ${s}`)

process.exit(doctorOk ? 0 : 1)
