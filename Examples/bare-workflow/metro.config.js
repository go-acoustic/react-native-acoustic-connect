const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const path = require('path')

/**
 * Metro configuration - standalone (published sample).
 * https://reactnative.dev/docs/metro
 *
 * `@shared` resolves to the vendored ./shared subdirectory — the cross-sample
 * UI, kept as a sibling in the SDK monorepo and vendored here at publish time
 * so the standalone sample stays self-contained.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    extraNodeModules: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
}

module.exports = mergeConfig(getDefaultConfig(__dirname), config)
