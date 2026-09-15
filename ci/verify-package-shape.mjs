#!/usr/bin/env node
/**********************************************************************************************
* Copyright (C) 2026 Acoustic, L.P. All rights reserved.
*
* NOTICE: This file contains material that is confidential and proprietary to
* Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
* industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
* Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
* prohibited.
**********************************************************************************************/

/**
 * CA-157726 — assert the shape of the npm tarball, on every branch.
 *
 * Why this exists: nothing in a feature-branch build looks at the tarball. The
 * workspace example apps consume the SDK from source (`react-native: "src/index"`,
 * a `:path` podspec, Metro `watchFolders`), so a `files` whitelist that has gone
 * stale, or a build output that never got produced, is invisible until the
 * develop-only sample gates install the packed tarball — i.e. after merge, where
 * it blocks the beta publish instead of the PR.
 *
 * What it does NOT do: prove the package installs or compiles. That is the sample
 * gates' job and this is no substitute for them. This only checks contents.
 *
 * `--ignore-scripts` keeps `prepack` from writing to stdout and corrupting the
 * JSON. The only thing `prepack` does is `build:plugin`, which the Test stage
 * already runs via `npm run test:plugin` — so call this after that.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

// Paths the tarball must contain. Entry points are derived from package.json
// rather than hardcoded, so this keeps working if the bundler's output naming
// changes — what matters is that the fields consumers resolve actually resolve.
const CANDIDATE_EXTS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.d.ts']

// `react-native: "src/index"` is extensionless, so an entry point is satisfied by
// any of these spellings. Returns the list of acceptable paths for one field.
function candidatesFor(value) {
  const base = value.replace(/^\.\//, '')
  return CANDIDATE_EXTS.map((ext) => `${base}${ext}`)
}

const entryPoints = ['main', 'module', 'types', 'react-native']
  .map((field) => pkg[field])
  .filter(Boolean)
  .map(candidatesFor)

// Each element is a list of acceptable spellings; one of them must be present.
const required = [
  ...entryPoints,
  // Expo Config Plugin surface — the Expo gates run `expo prebuild`, which loads
  // app.plugin.js, which requires the compiled plugin.
  ['app.plugin.js'],
  ['plugin/build/index.js'],
  // Consumed by name from a consumer's Podfile (see Examples/bare-workflow/ios/Podfile,
  // which node-resolves this exact path) and by the podspec/gradle config step.
  ['cli/ios/connect_pods.rb'],
  ['cli/index.mjs'],
  ['AcousticConnectRN.podspec'],
  ['android/build.gradle'],
  ['android/config.gradle'],
  ['ConnectConfig.example.json'],
]

// Paths that must NOT ship: developer config, and internal test files (CLAUDE.md
// states test files are excluded from the tarball — assert it).
const forbiddenExact = ['ConnectConfig.json']
const forbiddenPatterns = [
  /(^|\/)__tests__\//,
  /\.test\.(ts|tsx|js|jsx|mjs)$/,
  /^ios\/Tests\//,
  /^android\/src\/test\//,
]

function packFileList() {
  const raw = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    cwd: new URL('..', import.meta.url),
  })
  // Be tolerant of anything npm printed before the JSON payload.
  const start = raw.indexOf('[')
  if (start < 0) throw new Error(`npm pack --json produced no JSON array:\n${raw.slice(0, 2000)}`)
  const parsed = JSON.parse(raw.slice(start))
  const entry = Array.isArray(parsed) ? parsed[0] : parsed
  if (!entry?.files) throw new Error('npm pack --json payload has no `files` array')
  return entry.files.map((f) => f.path)
}

const files = packFileList()
const present = new Set(files)

const missing = required
  .filter((spellings) => !spellings.some((p) => present.has(p)))
  .map((spellings) => spellings[0])
const forbidden = files.filter(
  (p) => forbiddenExact.includes(p) || forbiddenPatterns.some((re) => re.test(p))
)

console.log(`Tarball contains ${files.length} files`)

if (missing.length) {
  console.error('\nMISSING from the tarball (required):')
  for (const p of missing) console.error(`  - ${p}`)
  console.error(
    '\nEither the build output was not produced (run `npm run build` / `npm run build:plugin`)\n' +
      'or the `files` whitelist in package.json no longer covers it.'
  )
}

if (forbidden.length) {
  console.error('\nSHOULD NOT be in the tarball:')
  for (const p of forbidden) console.error(`  - ${p}`)
  console.error('\nAdd a negation to the `files` whitelist in package.json.')
}

if (missing.length || forbidden.length) {
  console.error('\nPackage shape check FAILED.')
  process.exit(1)
}

console.log('Package shape check PASSED.')
