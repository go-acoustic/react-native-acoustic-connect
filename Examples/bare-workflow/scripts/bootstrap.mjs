#!/usr/bin/env node
// Bare-workflow demo bootstrap — orchestrator over the SDK's shared setup CLI.
//
// The config validation + ConnectConfig.json scaffolding that used to live here
// now ships in the SDK package (`acoustic-connect doctor`), and the iOS push
// extensions are wired by `acoustic-connect setup-ios-push`. This script keeps
// the sample-specific orchestration the CLI deliberately leaves out: installing
// JS dependencies (workspace-aware), and the per-platform toolchain / signing /
// pod-install / google-services steps. Re-runnable (idempotent).
//
//   npm run bootstrap              # auto-detect platforms for this OS
//   npm run bootstrap:ios          # iOS only (macOS)
//   npm run bootstrap:android      # Android only
//   node scripts/bootstrap.mjs --platform=ios --skip-pods
//
// Flags: --platform=ios|android|auto (default auto), --skip-install, --skip-pods.

import {existsSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const demoDir = path.resolve(scriptDir, '..')

// Locate the SDK's bundled CLI + helpers. In-repo (workspace) it sits two
// levels up; in a standalone published clone it's under node_modules.
function findCliDir() {
  const candidates = [
    path.resolve(demoDir, '..', '..', 'cli'),
    path.resolve(demoDir, 'node_modules', 'react-native-acoustic-connect', 'cli'),
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

const lib = await import(pathToFileURL(path.join(cliDir, 'lib.mjs')))
const {Reporter, color, info, run, section, findWorkspaceRoot} = lib
const cli = path.join(cliDir, 'index.mjs')

function parseArgs(argv) {
  const flags = {platform: 'auto', skipInstall: false, skipPods: false}
  for (const arg of argv) {
    if (arg.startsWith('--platform=')) flags.platform = arg.split('=')[1]
    else if (arg === '--skip-install') flags.skipInstall = true
    else if (arg === '--skip-pods') flags.skipPods = true
  }
  return flags
}

function installDependencies(reporter, flags) {
  if (flags.skipInstall) {
    reporter.warn('npm install', 'skipped (--skip-install)')
    return
  }
  const workspaceRoot = findWorkspaceRoot(demoDir)
  const installDir = workspaceRoot || demoDir
  const where = workspaceRoot ? 'workspace root (hoisted)' : 'demo (standalone)'
  section(`Installing JS dependencies — ${where}`)
  info(installDir)
  if (run('npm install', {cwd: installDir})) reporter.pass('npm install')
  else reporter.fail('npm install', `failed in ${installDir}`)
}

async function runPlatform(name, reporter, ctx) {
  let mod
  try {
    mod = await import(`./bootstrap.${name}.mjs`)
  } catch (err) {
    reporter.warn(`${name} bootstrap`, `module failed to load — skipped (${err.message})`)
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

  // 1. Config: doctor scaffolds ConnectConfig.json + validates identifiers,
  //    App Group, and google-services. Its own summary explains any fixes.
  const doctorOk = run(`node "${cli}" doctor "${demoDir}"`)

  // 2. Sample-specific orchestration (install + per-platform toolchain).
  const reporter = new Reporter()
  const ctx = {demoDir, flags, cli, lib}

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
    'Stuck? See README "Troubleshooting" or run the /run-demo-push skill',
  ].filter(Boolean)

  const code = reporter.summary(nextSteps)
  process.exit(code === 0 && doctorOk ? 0 : 1)
}

main().catch((err) => {
  console.error(color.red('\nbootstrap crashed:'), err)
  process.exit(1)
})
