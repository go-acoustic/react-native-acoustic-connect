// `acoustic-connect doctor [dir]` — pre-build doctor + config scaffolder.
//
// One command that checks the prerequisites and validates the bits of Acoustic
// Connect integration that otherwise fail late and confusingly at build time:
// the App Group format, a Java-safe Android package, and the
// google-services.json package match. It also scaffolds the gitignored
// ConnectConfig.json from the committed example so a fresh clone has something
// to edit.
//
// Auto-detects the project shape:
//   - Expo  : a root app.json with an `expo` block (identifiers live there;
//             google-services.json sits at the project root).
//   - bare  : an android/app/build.gradle (identifiers come from
//             applicationId; google-services.json sits under android/app/).
//
// It is read-mostly: the only thing it writes is a missing ConnectConfig.json
// (copied from the example). It never touches native projects, installs
// dependencies, or creates Apple/Firebase resources — those are owned by the
// platform tooling and the developer's accounts.

import fs from 'node:fs'
import path from 'node:path'

import {
  Reporter,
  capture,
  color,
  copyIfMissing,
  fileExists,
  readJson,
  readText,
  section,
} from './lib.mjs'

// App Group format per Apple + the Config Plugin's own validator
// (plugin/src/withConnectNSE.ts: APP_GROUP_PATTERN).
const APP_GROUP_PATTERN = /^group\.[A-Za-z0-9.-]+$/

// The committed sample ships placeholder identifiers (com.example.*) that the
// consumer is expected to replace with their own — setting app.json identity is
// the normal Expo workflow, not something the SDK rewrites for you. Flag a value
// still on the placeholder so it isn't shipped by accident.
const PLACEHOLDER_ID_PREFIX = 'com.example.'

// Sentinels shipped in ConnectConfig.example.json — a value still on one of
// these means the consumer hasn't filled it in.
const PLACEHOLDER_APP_KEY = 'YOUR_CONNECT_APP_KEY_HERE'
const PLACEHOLDER_APP_GROUP = 'YOUR_APP_GROUP_ID_HERE'
const PLACEHOLDER_TEAM = 'YOUR_TEAM_ID'
// Host of the placeholder collector URLs in the bare sample's example config.
const PLACEHOLDER_COLLECTOR_HOST = 'collector.example.com'
// Apple Team IDs are 10 uppercase-alphanumeric characters.
const TEAM_PATTERN = /^[A-Z0-9]{10}$/

// A usable collector endpoint: a parseable https URL whose host isn't the
// example placeholder. Used for PostMessageUrl / KillSwitchUrl.
function isValidCollectorUrl(value) {
  if (!value || typeof value !== 'string') return false
  let u
  try {
    u = new URL(value)
  } catch {
    return false
  }
  return u.protocol === 'https:' && u.hostname !== PLACEHOLDER_COLLECTOR_HOST
}

// Java reserved words (+ literals) that cannot appear as a package segment.
// Expo uses android.package as the Java/Kotlin namespace, so any segment that
// is a keyword breaks the Gradle build ("not a valid Java package name").
const JAVA_KEYWORDS = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
  'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
  'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
  'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new',
  'package', 'private', 'protected', 'public', 'return', 'short', 'static',
  'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
  'transient', 'try', 'void', 'volatile', 'while', 'true', 'false', 'null',
])

// Decide whether `dir` is an Expo or a bare React Native project.
export function detectProjectType(dir) {
  const appJson = readJson(path.join(dir, 'app.json'))
  if (appJson && appJson.expo) return 'expo'
  // A bare RN app always declares `react-native` in its manifest. Use that as
  // the discriminator rather than a bare `android/` directory — any Flutter or
  // native-Android project also has one, and would be misclassified as bare.
  const pkg = readJson(path.join(dir, 'package.json'))
  const deps = {...pkg?.dependencies, ...pkg?.devDependencies}
  if (deps['react-native']) return 'bare'
  return 'unknown'
}

function checkNode(reporter) {
  const major = Number(process.versions.node.split('.')[0])
  if (major >= 20) reporter.pass(`Node ${process.versions.node}`)
  else
    reporter.fail(
      `Node ${process.versions.node}`,
      'Node >= 20 is required — upgrade Node and re-run',
    )
}

// Scaffold the per-developer ConnectConfig.json from the committed example.
function ensureConnectConfig(reporter, dir) {
  const dest = path.join(dir, 'ConnectConfig.json')
  const src = path.join(dir, 'ConnectConfig.example.json')
  const result = copyIfMissing(src, dest)
  if (result === 'created')
    reporter.warn(
      'ConnectConfig.json',
      'created from example — EDIT it: set AppKey + collector URLs (PostMessageUrl/KillSwitchUrl), and iOSAppGroupIdentifier for push',
    )
  else if (result === 'exists') reporter.pass('ConnectConfig.json present')
  else reporter.fail('ConnectConfig.json', 'ConnectConfig.example.json missing')
}

// Validate the ConnectConfig.json values. The push-required inputs (collector
// URLs, App Group, iOS signing team) are only HARD failures when push is on —
// or when `--require-push` forces it. A client that doesn't use push needs
// nothing beyond AppKey, so off-push these stay advisory and never block.
//
// A bad value otherwise fails the Config Plugin during `expo prebuild` / the
// iOS extensions at build time, not here, so catch it early. Returns
// { appGroup, pushEnabled, strict } for downstream checks.
function checkConnectConfigValues(reporter, dir, {requirePush} = {}) {
  const cfg = readJson(path.join(dir, 'ConnectConfig.json'))
  if (cfg === undefined) {
    // Missing/failed was already reported by ensureConnectConfig; only flag a
    // present-but-broken file here.
    if (fileExists(path.join(dir, 'ConnectConfig.json')))
      reporter.fail('ConnectConfig.json', 'present but not valid JSON')
    return {strict: requirePush === true}
  }
  const connect = (cfg && cfg.Connect) || {}
  const appGroup = connect.iOSAppGroupIdentifier
  const pushEnabled = connect.PushEnabled === true
  // Push-required inputs are strict iff push is on (or forced via flag).
  const strict = pushEnabled || requirePush === true
  const gate = (label, detail) =>
    strict ? reporter.fail(label, detail) : reporter.warn(label, detail)

  // AppKey — the one value the SDK always needs to reach the collector. Under
  // push it's a hard gate; off push it stays advisory (a non-push client may
  // simply not have wired it yet — but it still needs it to send anything).
  const appKey = connect.AppKey
  if (appKey && appKey !== PLACEHOLDER_APP_KEY) reporter.pass('AppKey', 'set')
  else
    gate(
      'AppKey',
      `not set (empty or still "${PLACEHOLDER_APP_KEY}") — required to send to the collector`,
    )

  // Collector URLs — the push registration (and every event) posts here. The
  // example ships unfilled placeholders, so reject those under push.
  for (const key of ['PostMessageUrl', 'KillSwitchUrl']) {
    if (isValidCollectorUrl(connect[key])) reporter.pass(key, 'set')
    else
      gate(
        key,
        `"${connect[key] ?? ''}" is not a valid https collector URL (host must not be ${PLACEHOLDER_COLLECTOR_HOST})`,
      )
  }

  // App Group — the shared store the iOS NSE/NCE rich-push extensions read/write.
  if (appGroup && appGroup !== PLACEHOLDER_APP_GROUP) {
    if (APP_GROUP_PATTERN.test(appGroup))
      reporter.pass('iOSAppGroupIdentifier', appGroup)
    else
      reporter.fail(
        'iOSAppGroupIdentifier',
        `"${appGroup}" is invalid — must match group.<reverse-dns> (letters/digits/dots/hyphens)`,
      )
  } else {
    gate(
      'iOSAppGroupIdentifier',
      appGroup
        ? `still the placeholder "${appGroup}" — set your own App Group`
        : 'not set — required for the iOS NSE/NCE rich-push extensions',
    )
  }

  // iOS signing team — without it a CLI build drops aps-environment to ad-hoc
  // signing and the OS issues no APNs token (silent on the Simulator).
  const team = connect.iOSDevelopmentTeam
  if (team && team !== PLACEHOLDER_TEAM && TEAM_PATTERN.test(team))
    reporter.pass('iOSDevelopmentTeam', team)
  else
    gate(
      'iOSDevelopmentTeam',
      team && team !== PLACEHOLDER_TEAM
        ? `"${team}" is not a 10-char Apple Team ID`
        : 'not set — required so the iOS build embeds aps-environment (no APNs token without it)',
    )

  return {appGroup, pushEnabled, strict}
}

function validateAndroidPackage(reporter, label, pkg) {
  if (!pkg) {
    reporter.warn(label, 'not set')
    return
  }
  const badSegment = pkg.split('.').find((seg) => JAVA_KEYWORDS.has(seg))
  if (badSegment)
    reporter.fail(
      label,
      `"${pkg}" — segment "${badSegment}" is a Java keyword; the Android build will fail. Use a Java-safe package (the iOS bundle id may keep it).`,
    )
  else reporter.pass(label, pkg)
}

// Expo: identifiers live in app.json's expo block. Under push (`strict`) the
// ids must be set and off the sample placeholder, because android.package must
// match a client in google-services.json (Gradle fails otherwise) and
// ios.bundleIdentifier drives APNs. Off push these stay advisory. Returns the
// resolved android.package and the configured googleServicesFile (if any).
function checkAppJson(reporter, dir, {strict} = {}) {
  const appJson = readJson(path.join(dir, 'app.json'))
  if (!appJson || !appJson.expo) {
    reporter.fail('app.json', 'missing or has no "expo" block')
    return {}
  }
  const expo = appJson.expo
  const androidPackage = expo.android && expo.android.package
  const iosBundleId = expo.ios && expo.ios.bundleIdentifier
  const gsFile = expo.android && expo.android.googleServicesFile
  const gate = (label, detail) =>
    strict ? reporter.fail(label, detail) : reporter.warn(label, detail)

  // android.package: must be set + non-placeholder under push; always
  // keyword-checked when present (a Java keyword segment breaks the build).
  if (!androidPackage)
    gate('android.package', 'not set in app.json — required for the Android build / FCM')
  else if (androidPackage.startsWith(PLACEHOLDER_ID_PREFIX))
    gate(
      'android.package',
      `still the sample placeholder "${androidPackage}" — set your own (must match a client in google-services.json)`,
    )
  else validateAndroidPackage(reporter, 'android.package', androidPackage)

  // ios.bundleIdentifier: must be set + non-placeholder under push (drives APNs).
  if (!iosBundleId) gate('ios.bundleIdentifier', 'not set in app.json')
  else if (iosBundleId.startsWith(PLACEHOLDER_ID_PREFIX))
    gate(
      'ios.bundleIdentifier',
      `still the sample placeholder "${iosBundleId}" — set your own in app.json before building`,
    )
  else reporter.pass('ios.bundleIdentifier', iosBundleId)

  return {androidPackage, iosBundleId, gsFile}
}

// Expo only: an incremental `expo prebuild` does NOT propagate an app.json
// android.package change into an already-generated android/app/build.gradle
// (prebuild is non-destructive). Catch the stale applicationId so the developer
// doesn't hit a confusing google-services mismatch on a config they "already
// fixed".
function checkExpoCleanPrebuild(reporter, dir, {androidPackage, strict} = {}) {
  if (!androidPackage) return
  const gradle = readText(path.join(dir, 'android', 'app', 'build.gradle'))
  if (!gradle) return // not prebuilt yet — nothing stale to catch
  const appId = gradle.match(/applicationId\s+["']([^"']+)["']/)?.[1]
  if (appId && appId !== androidPackage) {
    const detail = `generated applicationId "${appId}" ≠ app.json android.package "${androidPackage}" — run \`npx expo prebuild --platform android --clean\` to regenerate`
    if (strict) reporter.fail('android/ (stale prebuild)', detail)
    else reporter.warn('android/ (stale prebuild)', detail)
  }
}

// iOS only, macOS only, best-effort hint — NEVER a hard failure. A *local dev*
// CLI build with no Development certificate falls back to ad-hoc signing, which
// drops aps-environment → no APNs token. But a CI/release machine that signs
// with an Apple Distribution certificate (and has no Development cert) is a
// perfectly valid configuration, so blocking it would be wrong — this stays a
// warning either way. Skips silently when `security` is unavailable (non-mac /
// locked keychain).
function checkIosSigningIdentity(reporter) {
  if (process.platform !== 'darwin') return
  const {ok, stdout} = capture('security find-identity -p codesigning -v')
  if (!ok) return
  if (/Apple Development|iPhone Developer/.test(stdout))
    reporter.pass('iOS signing identity', 'Apple Development certificate present')
  else
    reporter.warn(
      'iOS signing identity',
      'no Apple Development certificate in the keychain — fine for CI/release (Distribution signing), but a local dev push build needs one, else ad-hoc signing drops aps-environment (no APNs token). Add your Apple ID in Xcode → Accounts and build once with -allowProvisioningUpdates.',
    )
}

// Bare: read identifiers from android/app/build.gradle. Two distinct fields:
//   - `namespace`     → the R-class / Java package; MUST be a valid Java
//                       package (keyword check applies here).
//   - `applicationId` → the published app id; may contain segments that are
//                       not valid Java identifiers (e.g. `new`), so it is NOT
//                       keyword-checked. It is what FCM matches in
//                       google-services.json, so it's returned for that check.
// (Expo collapses both into android.package, which is why checkAppJson
// keyword-checks that single field.)
function checkBareAndroidId(reporter, dir) {
  const gradle = readText(path.join(dir, 'android', 'app', 'build.gradle'))
  const namespace = gradle?.match(/namespace\s+["']([^"']+)["']/)?.[1] || null
  const appId = gradle?.match(/applicationId\s+["']([^"']+)["']/)?.[1] || null
  validateAndroidPackage(reporter, 'namespace', namespace)
  if (appId) reporter.pass('applicationId', appId)
  else reporter.warn('applicationId', 'not set')
  return {androidPackage: appId}
}

// google-services.json must contain a client whose package_name matches the
// Android package (FCM matches by package); the gradle plugin fails otherwise
// ("No matching client found for package name").
function checkGoogleServices(reporter, {gsPath, androidPackage, strict}) {
  if (!fileExists(gsPath)) {
    if (strict)
      reporter.fail(
        'google-services.json',
        'missing — required for Android FCM builds (add the Firebase Android app, then download it here)',
      )
    else reporter.pass('google-services.json', 'not present (push disabled)')
    return
  }
  const gs = readJson(gsPath)
  if (gs === undefined) {
    reporter.fail('google-services.json', 'present but not valid JSON')
    return
  }
  const isPlaceholder =
    gs.project_info?.project_id === 'your-firebase-project-id' ||
    JSON.stringify(gs).includes('REPLACE_WITH_YOUR_FIREBASE')
  const packages = (gs.client || [])
    .map((c) => c.client_info?.android_client_info?.package_name)
    .filter(Boolean)
  if (isPlaceholder) {
    const detail = `placeholder values — replace with your real Firebase config (register package '${androidPackage}')`
    if (strict) reporter.fail('google-services.json', detail)
    else reporter.warn('google-services.json', detail)
  } else if (androidPackage && !packages.includes(androidPackage))
    reporter.fail(
      'google-services.json',
      `no client matches '${androidPackage}' (has: ${packages.join(', ') || 'none'}). Register that package in Firebase and re-download.`,
    )
  else reporter.pass('google-services.json', 'package match')
}

// Collect *.entitlements files at most one level deep under iosDir (host +
// extension target folders), skipping Pods/build.
function findEntitlements(iosDir) {
  const out = []
  let entries
  try {
    entries = fs.readdirSync(iosDir, {withFileTypes: true})
  } catch {
    return out
  }
  for (const e of entries) {
    const p = path.join(iosDir, e.name)
    if (e.isFile() && e.name.endsWith('.entitlements')) out.push(p)
    else if (e.isDirectory() && e.name !== 'Pods' && e.name !== 'build') {
      try {
        for (const f of fs.readdirSync(p))
          if (f.endsWith('.entitlements')) out.push(path.join(p, f))
      } catch {
        /* ignore unreadable subdir */
      }
    }
  }
  return out
}

// Bare iOS only: the host entitlements must declare aps-environment + an App
// Group (the Config Plugin generates these for Expo).
function checkBareIosEntitlements(reporter, dir) {
  const iosDir = path.join(dir, 'ios')
  if (!fileExists(iosDir)) {
    reporter.warn('ios/', 'no ios/ directory found')
    return
  }
  const hasBoth = findEntitlements(iosDir).some((p) => {
    const t = readText(p) || ''
    return t.includes('aps-environment') && t.includes('application-groups')
  })
  if (hasBoth) reporter.pass('App entitlements (aps-environment + App Group)')
  else
    reporter.warn(
      'App entitlements',
      'no *.entitlements with both aps-environment and application-groups — run `acoustic-connect setup-ios-push`',
    )
}

// Run all relevant checks for `dir`. Returns the Reporter (caller decides how
// to print the summary / exit).
export function runDoctor(dir, {reporter = new Reporter(), flags = {}} = {}) {
  const requirePush = flags.requirePush === true
  const type = detectProjectType(dir)
  console.log(
    color.bold('\nAcoustic Connect doctor') +
      color.dim(`  (${type} project — ${dir})`),
  )

  section('Prerequisites')
  checkNode(reporter)

  section('Configuration')
  ensureConnectConfig(reporter, dir)
  const {strict = requirePush} = checkConnectConfigValues(reporter, dir, {
    requirePush,
  })

  section('Identifiers')
  let androidPackage
  let gsFile
  if (type === 'expo') {
    ;({androidPackage, gsFile} = checkAppJson(reporter, dir, {strict}))
  } else if (type === 'bare') {
    ;({androidPackage} = checkBareAndroidId(reporter, dir))
  } else {
    reporter.warn(
      'project type',
      'could not detect Expo or bare RN layout — skipping identifier checks',
    )
  }

  section('Android push (FCM)')
  const gsPath =
    type === 'expo'
      ? path.join(dir, gsFile || 'google-services.json')
      : path.join(dir, 'android', 'app', 'google-services.json')
  checkGoogleServices(reporter, {gsPath, androidPackage, strict})
  if (type === 'expo') checkExpoCleanPrebuild(reporter, dir, {androidPackage, strict})

  section('iOS push')
  if (type === 'bare') checkBareIosEntitlements(reporter, dir)
  // Signing-identity hint is only relevant to push (it's about the
  // aps-environment drop). Skip it for non-push projects to avoid noise; it's
  // always a warning when it does run, so it never blocks a Distribution-only
  // CI/release machine.
  if (strict) checkIosSigningIdentity(reporter)

  return reporter
}
