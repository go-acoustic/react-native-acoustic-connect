// RN 0.85 moved the Jest preset out of core into its own `@react-native/jest-preset`
// package: core's `jest-preset.js` became a stub that throws with a migration
// message, and 0.87 drops the file entirely. The package does not exist below
// 0.85, so neither name works across the whole supported range — resolve
// whichever one is actually installed.
//
// Note it is NOT enough to bump react-native: `@react-native/jest-preset` is a
// peer of RN, and npm does not install it automatically (verified on 0.86.3),
// so a dev bump to >= 0.85 must add it to devDependencies explicitly. This probe
// then picks it up with no edit here.
const preset = (() => {
  try {
    require.resolve('@react-native/jest-preset')
    return '@react-native/jest-preset'
  } catch {
    // Not installed. Below 0.85 that is expected — core still carries a usable
    // preset. At 0.85+ it means the devDep is missing, and falling through to
    // the core name would surface jest's generic "preset has moved" validation
    // error, which names neither this file nor the missing package. Fail with
    // the actual remedy instead.
    const { version } = require('react-native/package.json')
    const [major, minor] = version.split('.').map(Number)
    if (major === 0 && minor < 85) return 'react-native'
    throw new Error(
      `React Native ${version} moved the Jest preset into '@react-native/jest-preset', ` +
        'which is not installed. npm will not add it for you — it is only a peer of ' +
        'react-native — so a dev bump to >= 0.85 must install it explicitly:\n\n' +
        `  npm install --save-dev --save-exact @react-native/jest-preset@${version}\n`
    )
  }
})()

module.exports = {
  preset,
  // Restrict test discovery + haste-map crawling to the SDK source. Without
  // this, jest crawls example/ and Examples/ (their own RN trees and ios Pods),
  // which is slow and produces duplicate-module warnings. '<rootDir>/__mocks__'
  // must be listed explicitly for the node_modules manual mock to auto-apply
  // when `roots` is customized.
  roots: ['<rootDir>/src', '<rootDir>/__mocks__'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/lib/',
    '<rootDir>/plugin/',
    '<rootDir>/example/',
    '<rootDir>/Examples/',
    '<rootDir>/nitrogen/',
  ],
  modulePathIgnorePatterns: ['<rootDir>/lib/'],
  // Preset default + react-native-nitro-modules, which ships untranspiled TS
  // via its package.json "react-native" field (honored by the RN jest resolver).
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-nitro-modules)/)',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/specs/**'],
  coverageDirectory: 'reports/coverage/js',
  // cobertura feeds the Jenkins coverage publisher + Slack summary; lcov's
  // HTML report is archived as a build artifact for browsing.
  coverageReporters: ['text-summary', 'lcov', 'cobertura'],
  // jest-junit XML feeds the Jenkins `junit` step (Test Result trend) and
  // the Slack test summary. The default reporter stays for local output.
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'reports/junit',
        outputName: 'js-unit-tests.xml',
        suiteName: 'JS unit tests (jest)',
        classNameTemplate: '{filepath}',
      },
    ],
  ],
}
