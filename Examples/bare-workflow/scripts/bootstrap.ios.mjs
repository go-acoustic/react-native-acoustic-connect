// iOS bootstrap module. Invoked by bootstrap.mjs as run(ctx).
//
// Sample-specific iOS orchestration for the bare-workflow demo: toolchain
// checks, signing config, and CocoaPods. The push-extension wiring (NSE + NCE)
// is delegated to the SDK CLI (`acoustic-connect setup-ios-push`), and the
// entitlements / App Group validation lives in `acoustic-connect doctor` (run
// earlier by bootstrap.mjs). Shared helpers come from the SDK's cli/lib.mjs via
// ctx.lib. Hard-skips on non-macOS.

import path from 'node:path'

export async function run(ctx) {
  const {reporter, demoDir, flags, cli, lib} = ctx
  const {commandExists, fileExists, info, run: sh} = lib

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

  // ── Signing team (single source: ConnectConfig.json) ──────────────────
  // The signing team has one source of truth — `Connect.iOSDevelopmentTeam`
  // in ConnectConfig.json. It's validated by `acoustic-connect doctor` (run
  // earlier by bootstrap.mjs) and stamped onto the host + both extensions by
  // setup-ios-push below. There is no Signing.xcconfig fallback any more.
  //
  // Note: setup-ios-push writes DEVELOPMENT_TEAM into the (committed) Xcode
  // project, so after bootstrapping with a team set, `git status` will show a
  // modified project.pbxproj carrying your personal Team ID — do not commit it.

  // ── Push extensions (NSE + NCE) ────────────────────────────────────────
  // Delegated to the SDK CLI: it writes the per-extension Swift/Info.plist/
  // entitlements from the shared templates (App Group from ConnectConfig.json)
  // and wires the Xcode targets idempotently. Same path Expo clients get via
  // the Config Plugin.
  if (sh(`node "${cli}" setup-ios-push "${demoDir}"`))
    reporter.pass('Push extensions wired (NSE + NCE)')
  else
    reporter.fail(
      'Push extensions',
      'acoustic-connect setup-ios-push failed — needs ruby + the xcodeproj gem (ships with CocoaPods)',
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
