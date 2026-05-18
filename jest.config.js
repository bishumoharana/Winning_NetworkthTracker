/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    // Exclude renderer tests — they need jsdom / browser environment
    '!**/src/renderer/**/*.test.ts',
    '!**/src/renderer/**/*.test.tsx',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/build/',
    '/dist/',
    // Renderer tests require a browser environment; run separately with
    // jest --config jest.renderer.config.js if/when added
    '/src/renderer/',
  ],
  transform: {
    '^.+\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
        jsx: 'react',
      },
    }],
  },
  moduleNameMapper: {
    '^@main/(.*)$':     '<rootDir>/src/main/$1',
    '^@renderer/(.*)$': '<rootDir>/src/renderer/$1',
    '^@shared/(.*)$':   '<rootDir>/src/shared/$1',
    // Mock CSS/style imports — renderer only, but keeps Jest from choking
    '\\.(css|less|scss|sass)$': '<rootDir>/src/__mocks__/styleMock.js',
    // Mock Electron: not available in Node/Jest environment
    '^electron$':          '<rootDir>/src/__mocks__/electron.ts',
    // Mock electron-updater: uses native Electron APIs at import time
    '^electron-updater$':  '<rootDir>/src/__mocks__/electron-updater.ts',
    // Mock electron-log: writes to filesystem paths that don't exist in CI
    '^electron-log$':      '<rootDir>/src/__mocks__/electron-log.ts',
    // Mock better-sqlite3: compiled for Electron ABI, not Node ABI
    // Loading the real binary in Jest (Node) causes a "wrong ELF class" crash
    '^better-sqlite3$':    '<rootDir>/src/__mocks__/better-sqlite3.ts',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/renderer/**',          // renderer covered separately
    '!src/renderer/index.tsx',
    '!src/main/main.ts',          // entry point — hard to unit-test
    '!src/main/preload.ts',       // preload — tested via integration
    '!src/__mocks__/**',
  ],
  // 60% is realistic for a mid-development Electron project;
  // raise to 80% once the project reaches feature-complete state
  coverageThreshold: {
    global: {
      branches:   60,
      functions:  60,
      lines:      60,
      statements: 60,
    },
  },
  verbose: true,
  // Prevent Jest from hanging after tests finish (common with Electron mocks
  // that leave open handles via setInterval / event emitters)
  forceExit: true,
  // Clear mocks between tests — prevents state leaking across test files
  clearMocks: true,
  restoreMocks: true,
};
