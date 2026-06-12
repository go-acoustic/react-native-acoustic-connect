// iOS bootstrap module. Invoked by bootstrap.mjs as run(ctx).
//
// Doctor + full-auto for the iOS half of the bare-workflow demo: signing config,
// push-extension wiring, CocoaPods. Hard-skips on non-macOS.

import path from 'node:path'

import {
  commandExists,
  copyIfMissing,
  fileExists,
  info,
  readText,
  run as sh,
} from './lib.mjs'

export async function run(ctx) {
  const {reporter, demoDir, flags} = ctx
  const iosDir = path.join(demoDir, 'ios')

  if (process.platform !== 'darwin') {
    reporter.warn('iOS', 'skipped — iOS builds require macOS')
    return
  }

  // ── Toolchain ──────────────────────────────────────────────────────────
  if (commandExists('xcodebuild')) reporter.pass('Xcode (xcodebuild)')
  else
    reporter.fail(
      'Xcode',
      'xcodebuild not found — install Xcode 26 and run xcode-select --install',
    )

  const hasBundler = commandExists('bundle')
  if (hasBundler || commandExists('pod')) reporter.pass('CocoaPods toolchain')
  else
    reporter.fail(
      'CocoaPods',
      'neither bundler nor pod found — gem install bundler (then bundle install)',
    )

  // ── Signing (the CLI no-token gotcha) ──────────────────────────────────
  // CLI builds (npm run ios / xcodebuild) don't auto-pick a team like the
  // Xcode GUI, so aps-environment is never embedded and no APNs token is
  // issued. The team is supplied per-developer via the gitignored
  // Signing.local.xcconfig.
  const signingLocal = path.join(iosDir, 'Signing.local.xcconfig')
  const signingExample = path.join(iosDir, 'Signing.local.example.xcconfig')
  const copied = copyIfMissing(signingExample, signingLocal)
  if (copied === 'created')
    reporter.warn(
      'ios/Signing.local.xcconfig',
      'created — set DEVELOPMENT_TEAM to your 10-char Apple Team ID (no token until you do)',
    )
  else if (copied === 'no-template')
    reporter.fail('ios/Signing.local.xcconfig', 'example template missing')
  else {
    const team = (readText(signingLocal) || '').match(
      /^\s*DEVELOPMENT_TEAM\s*=\s*(\S+)/m,
    )?.[1]
    if (!team || team === 'YOUR_TEAM_ID')
      reporter.warn(
        'DEVELOPMENT_TEAM',
        'not set in ios/Signing.local.xcconfig — APNs registration yields no token until set',
      )
    else reporter.pass('DEVELOPMENT_TEAM set', team)
  }

  // ── Push extensions (NSE + NCE) ────────────────────────────────────────
  // Idempotent: ensures the two extension targets exist and link their system
  // frameworks (NCE needs UserNotificationsUI or it crashes on expand).
  const scaffolder = path.join(iosDir, 'scripts', 'add_push_extensions.rb')
  if (!commandExists('ruby'))
    reporter.warn('Push extensions', 'ruby not found — skipped add_push_extensions.rb')
  else if (!fileExists(scaffolder))
    reporter.warn('Push extensions', 'add_push_extensions.rb missing — skipped')
  // Run via the absolute `scaffolder` path (not a cwd-relative one) so execution
  // doesn't depend on the working directory. The script resolves its own paths
  // from `__dir__`, so cwd is irrelevant to it; we still pin cwd to iosDir as a
  // sensible default. Quoted in case the checkout path contains spaces.
  else if (sh(`ruby "${scaffolder}"`, {cwd: iosDir}))
    reporter.pass('Push extensions wired (NSE + NCE)')
  else
    reporter.fail(
      'Push extensions',
      'add_push_extensions.rb failed (needs the xcodeproj gem — ships with CocoaPods)',
    )

  // ── Entitlements sanity ────────────────────────────────────────────────
  const ent = readText(
    path.join(
      iosDir,
      'ConnectBareWorkflowDemo',
      'ConnectBareWorkflowDemo.entitlements',
    ),
  )
  if (ent && ent.includes('aps-environment') && ent.includes('application-groups'))
    reporter.pass('App entitlements (aps-environment + App Group)')
  else
    reporter.warn(
      'App entitlements',
      'aps-environment / App Group not found in ConnectBareWorkflowDemo.entitlements',
    )

  // ── CocoaPods install ──────────────────────────────────────────────────
  if (flags.skipPods) {
    reporter.warn('pod install', 'skipped (--skip-pods)')
    return
  }
  if (fileExists(path.join(demoDir, 'Gemfile')) && hasBundler) {
    info('bundle install')
    if (!sh('bundle install', {cwd: demoDir}))
      reporter.warn('bundle install', 'failed — pod install may still work if pods are present')
  }
  info('pod install (this can take a few minutes)')
  const podCmd = hasBundler
    ? 'bundle exec pod install --project-directory=ios'
    : 'pod install --project-directory=ios'
  if (sh(podCmd, {cwd: demoDir})) reporter.pass('pod install')
  else
    reporter.fail(
      'pod install',
      'failed — try `pod repo update` (AcousticConnectDebug may be on git Specs before CDN)',
    )
}
