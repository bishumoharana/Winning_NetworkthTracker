/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
  ],
  transform: {
    '^.+\.tsx?$': ['ts-jest', {
      tsconfig: {
        // Use commonjs modules for Jest compatibility
        module: 'commonjs',
        esModuleInterop: true,
      },
    }],
  },
  moduleNameMapper: {
    '^@main/(.*)$': '<rootDir>/src/main/$1',
    '^@renderer/(.*)$': '<rootDir>/src/renderer/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    // Mock all CSS/style imports in tests
    '\\.(css|less|scss|sass)$': '<rootDir>/src/__mocks__/styleMock.js',
    // Mock Electron — it is not available in Node/Jest environment
    '^electron$': '<rootDir>/src/__mocks__/electron.ts',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/renderer/index.tsx',
    '!src/main/main.ts',
    '!src/main/preload.ts',
    '!src/__mocks__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  // Silence console noise during tests unless running in verbose mode
  silent: false,
  verbose: true,
};
