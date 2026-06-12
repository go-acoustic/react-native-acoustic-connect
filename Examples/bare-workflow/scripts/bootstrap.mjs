#!/usr/bin/env node
// Bare-workflow demo bootstrap — "doctor + full auto".
//
// One command to get the sample runnable: checks prerequisites, scaffolds any
// missing per-developer config from the committed templates, validates it, and
// installs dependencies. Re-runnable (idempotent) and safe to run from a fresh
// clone of the published sample.
//
//   npm run bootstrap              # auto-detect platforms for this OS
//   npm run bootstrap:ios          # iOS only (macOS)
//   npm run bootstrap:android      # Android only
//   node scripts/bootstrap.mjs --platform=ios --skip-pods
//
// Flags: --platform=ios|android|auto (default auto), --skip-install, --skip-pods.

import path from 'node:path'
import {fileURLToPath} from 'node:url'

import {
  Reporter,
  color,
  copyIfMissing,
  findWorkspaceRoot,
  info,
  run,
  section,
} from './lib.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const demoDir = path.resolve(scriptDir, '..')

function parseArgs(argv) {
  const flags = {platform: 'auto', skipInstall: false, skipPods: false}
  for (const arg of argv) {
    if (arg.startsWith('--platform=')) flags.platform = arg.split('=')[1]
    else if (arg === '--skip-install') flags.skipInstall = true
    else if (arg === '--skip-pods') flags.skipPods = true
  }
  return flags
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

// Ensure the per-developer ConnectConfig.json exists. Copied from the committed
// partner-generic example; the developer must then fill in their AppKey +
// collector URLs before the SDK will talk to a backend.
function ensureConnectConfig(reporter) {
  const dest = path.join(demoDir, 'ConnectConfig.json')
  const src = path.join(demoDir, 'ConnectConfig.example.json')
  const result = copyIfMissing(src, dest)
  if (result === 'created')
    reporter.warn(
      'ConnectConfig.json',
      'created from example — EDIT it: set AppKey + collector URLs (KillSwitchUrl/PostMessageUrl)',
    )
  else if (result === 'exists') reporter.pass('ConnectConfig.json present')
  else reporter.fail('ConnectConfig.json', 'ConnectConfig.example.json missing')
}

function installDependencies(reporter, flags) {
  if (flags.skipInstall) {
    reporter.warn('npm install', 'skipped (--skip-install)')
    return
  }
  const workspaceRoot = findWorkspaceRoot(demoDir)
  const installDir = workspaceRoot || demoDir
  const where = workspaceRoot
    ? 'workspace root (hoisted)'
    : 'demo (standalone)'
  section(`Installing JS dependencies — ${where}`)
  info(installDir)
  if (run('npm install', {cwd: installDir})) reporter.pass('npm install')
  else reporter.fail('npm install', `failed in ${installDir}`)
}

async function runPlatform(name, reporter, ctx) {
  let mod
  try {
    mod = await import(`./bootstrap.${name}.mjs`)
  } catch {
    reporter.warn(`${name} bootstrap`, 'no module yet — skipped')
    return
  }
  section(`Platform: ${name}`)
  await mod.run({...ctx, reporter})
}

async function main() {
  const flags = parseArgs(process.argv.slice(2))
  console.log(
    color.bold('\nBare-workflow demo bootstrap') +
      color.dim(`  (platform=${flags.platform})`),
  )

  const reporter = new Reporter()
  const ctx = {demoDir, flags}

  section('Prerequisites')
  checkNode(reporter)

  section('Configuration')
  ensureConnectConfig(reporter)

  installDependencies(reporter, flags)

  const isMac = process.platform === 'darwin'
  const platforms =
    flags.platform === 'auto'
      ? isMac
        ? ['ios', 'android']
        : ['android']
      : [flags.platform]

  for (const name of platforms) await runPlatform(name, reporter, ctx)

  const nextSteps = [
    'Fill in ConnectConfig.json (AppKey + collector) if you have not yet',
    'Start Metro:  npm run start',
    isMac ? 'Run iOS:      npm run ios' : null,
    'Run Android:  npm run android',
    'Stuck? See README "Troubleshooting" or run the /run-demo skill',
  ].filter(Boolean)

  const code = reporter.summary(nextSteps)
  process.exit(code)
}

main().catch((err) => {
  console.error(color.red('\nbootstrap crashed:'), err)
  process.exit(1)
})
