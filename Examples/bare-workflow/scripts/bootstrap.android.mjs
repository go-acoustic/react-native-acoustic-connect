// Android bootstrap module. Invoked by bootstrap.mjs as run(ctx).
//
// Doctor + full-auto for the Android half of the bare-workflow demo: toolchain
// checks, google-services scaffolding, and the FCM package-match validation
// that catches the #1 Android failure (processDebugGoogleServices "No matching
// client"). npm install is handled by the shared step in bootstrap.mjs.

import path from 'node:path'

import {
  capture,
  commandExists,
  copyIfMissing,
  fileExists,
  readText,
} from './lib.mjs'

function javaMajor() {
  // Returns the major Java version, or null if java is absent/unparseable.
  // (capture() uses spawnSync and returns rather than throwing when java is
  // missing, but guard explicitly so the intent is unambiguous.)
  if (!commandExists('java')) return null
  // `java -version` prints to stderr, e.g. openjdk version "17.0.10"
  const out = capture('java -version').stderr
  const m = out.match(/version "(\d+)(?:\.(\d+))?/)
  if (!m) return null
  return m[1] === '1' ? Number(m[2]) : Number(m[1])
}

function applicationId(demoDir) {
  const gradle = readText(path.join(demoDir, 'android', 'app', 'build.gradle'))
  return gradle?.match(/applicationId\s+["']([^"']+)["']/)?.[1] || null
}

export async function run(ctx) {
  const {reporter, demoDir} = ctx
  const androidDir = path.join(demoDir, 'android')

  // ── Toolchain ──────────────────────────────────────────────────────────
  const jdk = javaMajor()
  if (jdk === 17) reporter.pass('JDK 17')
  else if (jdk) reporter.warn('JDK', `found Java ${jdk} — the Android build needs JDK 17`)
  else reporter.fail('JDK', 'java not found — install a JDK 17 (e.g. Temurin 17)')

  if (commandExists('adb')) reporter.pass('adb on PATH')
  else
    reporter.fail(
      'adb',
      'not found — add platform-tools to PATH ($ANDROID_HOME/platform-tools)',
    )

  if (process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || commandExists('adb'))
    reporter.pass('Android SDK')
  else reporter.warn('Android SDK', 'set ANDROID_HOME to your SDK location')

  if (fileExists(path.join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')))
    reporter.pass('Gradle wrapper')
  else reporter.warn('Gradle wrapper', 'android/gradlew missing')

  // Best-effort: a connected emulator must be a Google Play image to get FCM.
  // Bounded timeout so an unresponsive/offline device can't hang the bootstrap.
  if (commandExists('adb')) {
    const gms = capture('adb shell pm list packages com.google.android.gms', {
      timeout: 10000,
    })
    if (gms.ok && gms.stdout.includes('com.google.android.gms'))
      reporter.pass('Play services on device')
    else
      reporter.warn(
        'Play services',
        'no Google Play device detected — FCM needs a Google Play AVD (gms + vending)',
      )
  }

  // ── google-services.json ───────────────────────────────────────────────
  const appId = applicationId(demoDir)
  const gsPath = path.join(androidDir, 'app', 'google-services.json')
  const gsTemplate = path.join(androidDir, 'app', 'google-services.json.template')
  const copied = copyIfMissing(gsTemplate, gsPath)
  if (copied === 'created') {
    // Freshly copied from the template — it IS the placeholder by definition,
    // so a single "fill it in" warning is enough; don't also run the validation
    // below (that would double-report the same placeholder).
    reporter.warn(
      'android/app/google-services.json',
      `created from template (placeholder) — replace with the real file from Firebase for package '${appId}'`,
    )
  } else if (copied === 'no-template') {
    reporter.fail('android/app/google-services.json', 'template missing')
  } else {
    // File already present — validate the FCM client matches the applicationId
    // (the gradle plugin fails otherwise: "No matching client found for package
    // name"), and flag a still-placeholder file.
    const gs = readText(gsPath)
    let parsed
    try {
      parsed = gs ? JSON.parse(gs) : null
    } catch {
      reporter.fail('google-services.json', 'is not valid JSON')
    }
    if (parsed && appId) {
      const isPlaceholder =
        parsed.project_info?.project_id === 'your-firebase-project-id' ||
        JSON.stringify(parsed).includes('REPLACE_WITH_YOUR_FIREBASE')
      const packages = (parsed.client || [])
        .map((c) => c.client_info?.android_client_info?.package_name)
        .filter(Boolean)
      if (isPlaceholder)
        reporter.warn(
          'google-services.json',
          `placeholder values — replace with your real Firebase config (register package '${appId}')`,
        )
      else if (packages.includes(appId))
        reporter.pass('google-services.json matches applicationId', appId)
      else
        reporter.fail(
          'google-services.json',
          `no client for '${appId}' (has: ${packages.join(', ') || 'none'}). Register that package in your Firebase project and download a fresh google-services.json`,
        )
    }
  }
}
