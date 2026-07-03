module.exports = {
  preset: 'react-native',
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
