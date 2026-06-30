// Copyright (C) 2026 Acoustic, L.P. All rights reserved.
//
// Thin entry shim for the Expo Config Plugin.
//
// Expo resolves the plugin from the package root via the `expo.plugins` field
// in app.json. This file delegates directly to the compiled plugin build so
// that Expo's Node.js environment (CommonJS) loads it correctly.
//
// The plugin composition is defined in plugin/src/index.ts and compiled to
// plugin/build/index.js (CommonJS) by `npm run build:plugin`.
//
// To add a new mod (e.g. withConnectNCE from CA-143488), extend the `mods`
// array in plugin/src/index.ts — do not modify this shim.

module.exports = require('./plugin/build/index').default
