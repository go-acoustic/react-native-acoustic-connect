// `acoustic-connect setup-ios-push [dir]` — create/repair the iOS push extensions.
//
// The manual-setup counterpart to what the Expo Config Plugin does on
// `prebuild`: it provisions the two app-extension targets a bare React Native
// app needs for Acoustic Connect rich push —
//
//   * ConnectNSE — Notification Service Extension
//   * ConnectNCE — Notification Content Extension
//
// Division of labour:
//   - THIS script (Node) owns the files: it writes the per-extension Swift,
//     Info.plist and entitlements from the SDK templates (substituting the App
//     Group from ConnectConfig.json), and ensures the host app has an
//     entitlements file with aps-environment + the App Group.
//   - add_push_extensions.rb (Ruby + xcodeproj) owns the pbxproj surgery:
//     it creates/links the targets, the embed phase, and the system frameworks.
//
// Everything is idempotent — existing files are left untouched, existing
// targets are skipped. Re-running repairs missing pieces without duplicating.

import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

import {color, commandExists, fileExists, readJson, readText, run, section} from '../lib.mjs'

const cliDir = path.dirname(path.dirname(fileURLToPath(import.meta.url))) // .../cli
const sdkRoot = path.dirname(cliDir) // package root
const templatesDir = path.join(cliDir, 'ios', 'templates')
// Swift principal-class templates are shared with the Expo Config Plugin.
const swiftDir = path.join(sdkRoot, 'plugin', 'swift')

const APP_GROUP_TOKEN = 'CONNECT_APP_GROUP_IDENTIFIER_PLACEHOLDER'

const EXTENSIONS = [
  {name: 'ConnectNSE', swift: 'NotificationService.swift'},
  {name: 'ConnectNCE', swift: 'NotificationViewController.swift'},
]

// Find the single .xcodeproj under <dir>/ios. The app target name follows the
// RN convention (the project basename), which is what `setup-ios-push` assumes.
function findXcodeproj(iosDir) {
  let entries = []
  try {
    entries = fs.readdirSync(iosDir)
  } catch {
    return null
  }
  const proj = entries.find((e) => e.endsWith('.xcodeproj'))
  return proj ? path.join(iosDir, proj) : null
}

// Write `content` to `dest` only if missing; report which happened.
function writeIfMissing(reporter, label, dest, content) {
  if (fileExists(dest)) {
    reporter.pass(label, 'present')
    return
  }
  fs.mkdirSync(path.dirname(dest), {recursive: true})
  fs.writeFileSync(dest, content)
  reporter.pass(label, 'created')
}

// Render a template file, substituting the App Group placeholder. Only the
// real occurrences are replaced — the Swift string literal and the plist
// <string> entry — so any explanatory comment that mentions the token by name
// (e.g. "The <token> is replaced by …") stays readable.
function renderTemplate(srcPath, appGroup) {
  const raw = readText(srcPath)
  if (raw == null) return null
  return raw
    .split(`"${APP_GROUP_TOKEN}"`)
    .join(`"${appGroup}"`)
    .split(`<string>${APP_GROUP_TOKEN}</string>`)
    .join(`<string>${appGroup}</string>`)
}

// Minimal host entitlements when the app has none yet: aps-environment +
// the App Group, matching what the extensions share.
function hostEntitlements(appGroup) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>aps-environment</key>
\t<string>development</string>
\t<key>com.apple.security.application-groups</key>
\t<array>
\t\t<string>${appGroup}</string>
\t</array>
</dict>
</plist>
`
}

export async function setupIosPush(dir, {reporter}) {
  console.log(
    color.bold('\nAcoustic Connect — iOS push extensions') +
      color.dim(`  (${dir})`),
  )

  if (process.platform !== 'darwin') {
    reporter.warn('iOS', 'skipped — iOS project surgery requires macOS')
    return
  }

  const iosDir = path.join(dir, 'ios')
  if (!fileExists(iosDir)) {
    reporter.fail('ios/', `no ios/ directory under ${dir}`)
    return
  }

  const projectPath = findXcodeproj(iosDir)
  if (!projectPath) {
    reporter.fail('.xcodeproj', `none found under ${iosDir}`)
    return
  }
  const appTarget = path.basename(projectPath, '.xcodeproj')
  reporter.pass('Xcode project', `${path.basename(projectPath)} (target ${appTarget})`)

  // App Group is the linchpin — host + both extensions must share it.
  const cfg = readJson(path.join(dir, 'ConnectConfig.json'))
  const appGroup = cfg?.Connect?.iOSAppGroupIdentifier
  if (!appGroup) {
    reporter.fail(
      'iOSAppGroupIdentifier',
      'not set in ConnectConfig.json — required for the NSE/NCE shared store. Run `acoustic-connect doctor` first.',
    )
    return
  }
  reporter.pass('App Group', appGroup)

  // ── Files (idempotent) ───────────────────────────────────────────────────
  section('Source files')

  // Host entitlements — only created if absent (never clobber a real one).
  const hostEntPath = path.join(iosDir, appTarget, `${appTarget}.entitlements`)
  writeIfMissing(
    reporter,
    `${appTarget}/${appTarget}.entitlements`,
    hostEntPath,
    hostEntitlements(appGroup),
  )

  for (const ext of EXTENSIONS) {
    const extDir = path.join(iosDir, ext.name)

    const swift = renderTemplate(path.join(swiftDir, ext.swift), appGroup)
    if (swift == null) {
      reporter.fail(`${ext.name}/${ext.swift}`, `template missing in ${swiftDir}`)
      return
    }
    writeIfMissing(reporter, `${ext.name}/${ext.swift}`, path.join(extDir, ext.swift), swift)

    const tplKey = ext.name === 'ConnectNSE' ? 'nse' : 'nce'
    const plist = readText(path.join(templatesDir, tplKey, 'Info.plist'))
    writeIfMissing(reporter, `${ext.name}/Info.plist`, path.join(extDir, 'Info.plist'), plist)

    const ent = renderTemplate(
      path.join(templatesDir, tplKey, `${ext.name}.entitlements`),
      appGroup,
    )
    writeIfMissing(
      reporter,
      `${ext.name}/${ext.name}.entitlements`,
      path.join(extDir, `${ext.name}.entitlements`),
      ent,
    )
  }

  // ── pbxproj surgery (Ruby) ─────────────────────────────────────────────────
  section('Xcode targets')
  if (!commandExists('ruby')) {
    reporter.warn(
      'Push extensions',
      'ruby not found — files written, but run add_push_extensions.rb on a machine with ruby + the xcodeproj gem to wire the targets',
    )
    return
  }

  const rubyScript = path.join(cliDir, 'ios', 'add_push_extensions.rb')
  // Pass the project path / target name as real environment variables (the
  // Ruby script reads them via ENV[…]) rather than interpolating them into the
  // command line — a path with shell metacharacters must not be re-parsed.
  // The signing team (when configured) is forwarded so the scaffolder stamps
  // DEVELOPMENT_TEAM on the host + both extensions; without it a CLI build
  // drops aps-environment to ad-hoc and yields no APNs token.
  const team = cfg?.Connect?.iOSDevelopmentTeam
  const rubyEnv = {
    ACOUSTIC_PROJECT_PATH: projectPath,
    ACOUSTIC_APP_TARGET: appTarget,
  }
  if (team) rubyEnv.ACOUSTIC_DEVELOPMENT_TEAM = team
  if (run(`ruby "${rubyScript}"`, {cwd: iosDir, env: rubyEnv}))
    reporter.pass('Push extensions wired (NSE + NCE)')
  else
    reporter.fail(
      'Push extensions',
      'add_push_extensions.rb failed — needs the xcodeproj gem (ships with CocoaPods: `gem install xcodeproj`)',
    )
}
