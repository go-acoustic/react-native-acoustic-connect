#!/usr/bin/env node
// `acoustic-connect` — setup CLI for the React Native Acoustic Connect SDK.
//
// Ships in the published package so client apps don't have to re-implement the
// integration plumbing our own sample apps used to carry. Subcommands:
//
//   acoustic-connect doctor [dir] [--require-push]  Validate config + scaffold ConnectConfig.json
//   acoustic-connect setup-ios-push [dir]           Create/repair the iOS NSE + NCE push extensions
//
// `dir` defaults to the current working directory (npm passes $INIT_CWD when
// run as a script). All commands are idempotent and safe to re-run.
//
// `doctor` treats the push-required inputs (collector URLs, App Group, iOS
// signing team, google-services, Expo ids) as HARD failures only when push is
// enabled (Connect.PushEnabled === true) or `--require-push` is passed. A
// non-push client needs nothing beyond AppKey and never trips these.

import path from 'node:path'

import {runDoctor} from './doctor.mjs'
import {setupIosPush} from './ios/setup-push.mjs'
import {Reporter, color} from './lib.mjs'

const USAGE = `acoustic-connect — React Native Acoustic Connect SDK setup

Usage:
  acoustic-connect doctor [dir] [--require-push]  Validate config + scaffold ConnectConfig.json
  acoustic-connect setup-ios-push [dir]           Create/repair the iOS NSE + NCE push extensions

dir defaults to the current directory.

  --require-push   Treat the push-required inputs as hard failures even when
                   Connect.PushEnabled is not true (push is otherwise the gate).`

// Resolve the target directory: explicit arg > $INIT_CWD (npm) > cwd.
function targetDir(arg) {
  if (arg && !arg.startsWith('-')) return path.resolve(arg)
  if (process.env.INIT_CWD) return path.resolve(process.env.INIT_CWD)
  return process.cwd()
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    console.log(USAGE)
    process.exit(command ? 0 : 1)
  }

  // First non-flag argument after the command is the target dir.
  const dirArg = args.slice(1).find((a) => !a.startsWith('-'))
  const dir = targetDir(dirArg)
  const requirePush = args.includes('--require-push')

  switch (command) {
    case 'doctor': {
      const reporter = runDoctor(dir, {flags: {requirePush}})
      process.exit(reporter.summary())
    }
    case 'setup-ios-push': {
      const reporter = new Reporter()
      await setupIosPush(dir, {reporter})
      process.exit(reporter.summary())
    }
    default:
      console.error(color.red(`Unknown command: ${command}\n`))
      console.log(USAGE)
      process.exit(1)
  }
}

main().catch((err) => {
  console.error(color.red('\nacoustic-connect crashed:'), err)
  process.exit(1)
})
