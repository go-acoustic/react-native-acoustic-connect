// Copyright (C) 2026 Acoustic, L.P. All rights reserved.
//
// Unit tests for the pure helper in plugin/src/withConnectAndroidConfig.ts.
// Uses Node's built-in test runner (node:test) against the compiled CommonJS
// output in plugin/build — no Jest / extra dependency required.
//
//   npm run test:plugin   (builds first, then runs)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const android = require('../build/withConnectAndroidConfig.js')

// ─── appendConfigGradleApply ────────────────────────────────────────────────

test('appendConfigGradleApply appends the apply line when absent', () => {
  const before = 'apply plugin: "com.android.application"\n'
  const after = android.appendConfigGradleApply(before)

  assert.ok(after.startsWith(before), 'preserves existing content')
  assert.ok(
    after.includes(android.CONFIG_GRADLE_APPLY),
    'adds the config.gradle apply line'
  )
})

test('appendConfigGradleApply is idempotent', () => {
  const before = 'apply plugin: "com.android.application"\n'
  const once = android.appendConfigGradleApply(before)
  const twice = android.appendConfigGradleApply(once)

  assert.equal(twice, once, 'second call adds nothing')

  // Exactly one occurrence of the apply line.
  const matches = twice.split('/config.gradle').length - 1
  assert.equal(matches, 1, 'apply line is present exactly once')
})

test('appendConfigGradleApply skips when a config.gradle apply already exists', () => {
  const before =
    'apply plugin: "com.android.application"\n' + android.CONFIG_GRADLE_APPLY
  assert.equal(
    android.appendConfigGradleApply(before),
    before,
    'no-op when already wired'
  )
})

test('CONFIG_GRADLE_APPLY references the SDK gradle project', () => {
  assert.ok(
    android.CONFIG_GRADLE_APPLY.includes(
      "project(':react-native-acoustic-connect')"
    )
  )
  assert.ok(android.CONFIG_GRADLE_APPLY.includes('/config.gradle'))
})
