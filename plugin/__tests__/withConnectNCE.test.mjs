// Copyright (C) 2026 Acoustic, L.P. All rights reserved.
//
// Unit tests for the pure helpers in plugin/src/withConnectNCE.ts.
// Uses Node's built-in test runner (node:test) against the compiled CommonJS
// output in plugin/build — no Jest / extra dependency required.
//
//   npm run test:plugin   (builds first, then runs)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const nce = require('../build/withConnectNCE.js')

// ─── NCE Info.plist ─────────────────────────────────────────────────────────

test('buildNCEInfoPlist declares the content-extension point + principal class', () => {
  const plist = nce.buildNCEInfoPlist()
  assert.match(plist, /com\.apple\.usernotifications\.content-extension/)
  assert.match(plist, /\$\(PRODUCT_MODULE_NAME\)\.NotificationViewController/)
})

test('buildNCEInfoPlist sets the rich-media category + content-size attributes', () => {
  const plist = nce.buildNCEInfoPlist()
  assert.match(plist, /UNNotificationExtensionCategory/)
  assert.match(plist, /ACOUSTIC_RICH_NOTIFICATION/)
  assert.match(plist, /ACTIONABLE_NOTIFICATION/)
  assert.match(plist, /UNNotificationExtensionInitialContentSizeRatio/)
  assert.match(plist, /UNNotificationExtensionDefaultContentHidden/)
})

test('buildNCEInfoPlist omits RCTNewArchEnabled (no RN runtime in the extension)', () => {
  // Intentional divergence from the bare-workflow reference, which carries it
  // as an Xcode-template leftover; the NCE links only the Connect SDK.
  assert.equal(nce.buildNCEInfoPlist().includes('RCTNewArchEnabled'), false)
})

// ─── NCE entitlements ───────────────────────────────────────────────────────

test('buildNCEEntitlements embeds the given app group', () => {
  const ent = nce.buildNCEEntitlements('group.com.example.app')
  assert.match(ent, /com\.apple\.security\.application-groups/)
  assert.match(ent, /<string>group\.com\.example\.app<\/string>/)
})

// ─── Podfile injection ──────────────────────────────────────────────────────

test('buildPodfileBlock contains the marker and ConnectNCE target', () => {
  const block = nce.buildPodfileBlock()
  assert.match(block, /@generated ConnectNCE target/)
  assert.match(block, /target 'ConnectNCE' do/)
  // Resolves the pod via the shared helper emitted by the NSE block.
  assert.match(block, /acoustic_connect_pod_nce/)
  assert.match(block, /AcousticConnectDebug/)
})

test('injectPodfileBlock is idempotent', () => {
  const base = "platform :ios, '15.1'\n"
  const once = nce.injectPodfileBlock(base)
  const twice = nce.injectPodfileBlock(once)
  assert.equal(once, twice, 're-injection must be a no-op')
  assert.equal((once.match(/target 'ConnectNCE' do/g) || []).length, 1)
})

test('injectPodfileBlock appends to existing Podfile content', () => {
  const base = "platform :ios\n"
  const out = nce.injectPodfileBlock(base)
  assert.ok(out.startsWith(base), 'existing content must be preserved')
  assert.match(out, /@generated ConnectNCE target/)
})
