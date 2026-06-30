// Android bootstrap module. Invoked by bootstrap.mjs as run(ctx).
//
// Sample-specific Android orchestration for the bare-workflow demo: toolchain
// checks (JDK / adb / SDK / gradle wrapper / Play services) and scaffolding the
// gitignored google-services.json from the committed template. The
// google-services package-match validation lives in `acoustic-connect doctor`
// (run earlier by bootstrap.mjs). Shared helpers come from the SDK's cli/lib.mjs
// via ctx.lib.

import path from 'node:path'

function javaMajor(capture, commandExists) {
  // Returns the major Java version, or null if java is absent/unparseable.
  if (!commandExists('java')) return null
  // `java -version` prints to stderr, e.g. openjdk version "17.0.10"
  const out = capture('java -version').stderr
  const m = out.match(/version "(\d+)(?:\.(\d+))?/)
  if (!m) return null
  return m[1] === '1' ? Number(m[2]) : Number(m[1])
}

export async function run(ctx) {
  const {reporter, demoDir, lib} = ctx
  const {capture, commandExists, copyIfMissing} = lib
  const androidDir = path.join(demoDir, 'android')

  // ── Toolchain ──────────────────────────────────────────────────────────
  const jdk = javaMajor(capture, commandExists)
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

  const wrapper = process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'
  if (ctx.lib.fileExists(path.join(androidDir, wrapper)))
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

  // ── google-services.json (scaffold only; doctor validates it) ──────────
  const gsPath = path.join(androidDir, 'app', 'google-services.json')
  const gsTemplate = path.join(androidDir, 'app', 'google-services.json.template')
  const copied = copyIfMissing(gsTemplate, gsPath)
  if (copied === 'created')
    reporter.warn(
      'android/app/google-services.json',
      'created from template (placeholder) — replace with the real file from Firebase',
    )
  else if (copied === 'no-template')
    reporter.fail('android/app/google-services.json', 'template missing')
  else reporter.pass('google-services.json present')
}
