// Copyright (C) 2026 Acoustic, L.P. All rights reserved.
//
// Unit tests for ensureConnectConfig's local→bundled→missing fallback in
// cli/doctor.mjs. Uses Node's built-in test runner (node:test) — no build
// step needed, cli/ is plain ESM.
//
//   npm run test:cli

import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { ensureConnectConfig } from '../doctor.mjs'
import { Reporter } from '../lib.mjs'

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'connect-doctor-test-'))
}

// ensureConnectConfig's 'exists' branch reports as `pass('ConnectConfig.json present')`
// (label includes the detail) while the other branches use a plain
// 'ConnectConfig.json' label with a separate detail string — match by prefix
// so the assertion doesn't depend on that formatting quirk.
function statusFor(reporter, labelPrefix) {
  return reporter.results.find((r) => r.label.startsWith(labelPrefix))?.status
}

test('ensureConnectConfig: prefers a project-local ConnectConfig.example.json over the bundled one', () => {
  const dir = tmpDir()
  fs.writeFileSync(
    path.join(dir, 'ConnectConfig.example.json'),
    JSON.stringify({ Connect: { AppKey: 'from-local-example' } }),
  )
  const reporter = new Reporter()

  ensureConnectConfig(reporter, dir, {
    bundledExample: path.join(dir, 'never-read.json'),
  })

  const written = JSON.parse(fs.readFileSync(path.join(dir, 'ConnectConfig.json'), 'utf8'))
  assert.equal(written.Connect.AppKey, 'from-local-example')
  assert.equal(statusFor(reporter, 'ConnectConfig.json'), 'warn')
})

test('ensureConnectConfig: falls back to the bundled example when no project-local one exists', () => {
  const dir = tmpDir()
  const bundledDir = tmpDir()
  const bundledExample = path.join(bundledDir, 'ConnectConfig.example.json')
  fs.writeFileSync(bundledExample, JSON.stringify({ Connect: { AppKey: 'from-bundled-example' } }))
  const reporter = new Reporter()

  ensureConnectConfig(reporter, dir, { bundledExample })

  const written = JSON.parse(fs.readFileSync(path.join(dir, 'ConnectConfig.json'), 'utf8'))
  assert.equal(written.Connect.AppKey, 'from-bundled-example')
  assert.equal(statusFor(reporter, 'ConnectConfig.json'), 'warn')
})

test('ensureConnectConfig: fails cleanly (no crash, no file written) when both are missing', () => {
  const dir = tmpDir()
  const reporter = new Reporter()

  ensureConnectConfig(reporter, dir, {
    bundledExample: path.join(dir, 'does-not-exist.json'),
  })

  assert.equal(fs.existsSync(path.join(dir, 'ConnectConfig.json')), false)
  assert.equal(statusFor(reporter, 'ConnectConfig.json'), 'fail')
})

test('ensureConnectConfig: never overwrites an existing ConnectConfig.json', () => {
  const dir = tmpDir()
  fs.writeFileSync(
    path.join(dir, 'ConnectConfig.json'),
    JSON.stringify({ Connect: { AppKey: 'already-configured' } }),
  )
  const reporter = new Reporter()

  ensureConnectConfig(reporter, dir, {
    bundledExample: path.join(dir, 'never-read.json'),
  })

  const written = JSON.parse(fs.readFileSync(path.join(dir, 'ConnectConfig.json'), 'utf8'))
  assert.equal(written.Connect.AppKey, 'already-configured')
  assert.equal(statusFor(reporter, 'ConnectConfig.json'), 'pass')
})
