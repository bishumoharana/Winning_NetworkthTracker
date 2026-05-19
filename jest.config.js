/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],

  // Only match test files under src/main — renderer tests need a browser
  // (jsdom) environment and a separate jest config if/when added.
  testMatch: [
    '<rootDir>/src/main/__tests__/**/*.test.ts',
  ],

  // Belt-and-braces: also ignore these paths even if testMatch somehow
  // picks them up.
  testPathIgnorePatterns: [
    '/node_modules/',
    '/build/',
    '/dist/',
    '<rootDir>/src/renderer/',
  ],

  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
        jsx: 'react',
        // Suppress ts-jest type-check errors from mock files
        diagnostics: false,
      },
    }],
  },

  moduleNameMapper: {
    // Path aliases
    '^@main/(.*)$':     '<rootDir>/src/main/$1',
    '^@renderer/(.*)$': '<rootDir>/src/renderer/$1',
    '^@shared/(.*)$':   '<rootDir>/src/shared/$1',

    // CSS / style imports — renderer only but keeps Jest from choking
    '\\.(css|less|scss|sass)$': '<rootDir>/src/__mocks__/styleMock.js',

    // Electron: not available in the Node/Jest environment
    '^electron$': '<rootDir>/src/__mocks__/electron.ts',

    // electron-updater: tries to resolve asar paths at import time
    '^electron-updater$': '<rootDir>/src/__mocks__/electron-updater.ts',

    // electron-log: writes to OS log paths that do not exist in CI
    '^electron-log$': '<rootDir>/src/__mocks__/electron-log.ts',

    // better-sqlite3: compiled for Electron ABI, not Node ABI.
    // See src/__mocks__/better-sqlite3.ts for full explanation.
    '^better-sqlite3$': '<rootDir>/src/__mocks__/better-sqlite3.ts',

    // systeminformation: makes real OS/network calls that fail in CI.
    // Tests that need specific behaviour use jest.mock() with custom returns.
    '^systeminformation$': '<rootDir>/src/__mocks__/systeminformation.ts',

    // adapterDetector: calls os.networkInterfaces() — mock for isolation
    '^.*/network/adapterDetector$': '<rootDir>/src/__mocks__/adapterDetector.ts',
  },

  collectCoverageFrom: [
    'src/main/**/*.{ts,tsx}',
    '!src/main/**/*.d.ts',
    '!src/main/main.ts',          // entry point — hard to unit-test
    '!src/main/preload.ts',       // covered by integration tests
    '!src/main/ipc/**',           // Electron IPC wiring — requires a live renderer
    '!src/main/network/trafficPoller.ts', // polling loop — requires live systeminformation
    '!src/__mocks__/**',
  ],

  // 60% is realistic for a mid-development Electron project.
  // Raise to 80% once the feature set is complete.
  coverageThreshold: {
    global: {
      branches:   60,
      functions:  60,
      lines:      60,
      statements: 60,
    },
  },

  // Prevent Jest from hanging after tests finish.
  // Electron mocks may leave open handles (setInterval / event emitters).
  forceExit: true,

  // Reset mocks between every test to prevent state leaking across files.
  clearMocks:   true,
  restoreMocks: true,

  verbose: true,
};
