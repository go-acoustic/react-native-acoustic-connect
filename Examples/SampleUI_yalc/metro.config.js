/* eslint-disable import/no-commonjs */
const { getDefaultConfig } = require('@expo/metro-config');
const escape = require('escape-string-regexp');
const blacklist = require('metro-config/src/defaults/exclusionList');
const path = require('path');
const root = path.resolve(__dirname, '..');
const defaultConfig = getDefaultConfig(__dirname);

const modules = [
  '@expo/vector-icons',
  'expo-constants',
  '@react-navigation/native',
  '@react-native/assets-registry',
  'react',
  'react-native',
  'react-native-safe-area-context',
  'react-native-vector-icons',
  '@expo/vector-icons',
  // 'react-native-acoustic-connect',
];

module.exports = {
  ...defaultConfig,

  projectRoot: __dirname,
  watchFolders: [root],

  // We need to make sure that only one version is loaded for peerDependencies
  // So we blacklist them at the root, and alias them to the versions in example's node_modules
  resolver: {
    ...defaultConfig.resolver,
    blacklistRE: blacklist(
      modules.map(
        (m) =>
          new RegExp(`^${escape(path.join(root, 'node_modules', m))}\\/.*$`)
      )
    ),

    extraNodeModules: modules.reduce((acc, name) => {
      acc[name] = path.join(__dirname, 'node_modules', name);
      return acc;
    }, {}),
  },

  transformer: {
    ...defaultConfig.transformer,
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};