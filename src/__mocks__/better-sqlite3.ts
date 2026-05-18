/**
 * Jest mock for better-sqlite3.
 *
 * better-sqlite3 is compiled against the Electron ABI, not the Node ABI,
 * so loading the real native binary inside Jest (which runs in plain Node)
 * causes an immediate crash: "was compiled against a different Node.js version".
 *
 * This mock provides the same interface as the real Database class so that
 * tests that call _setDbForTest() with a REAL in-memory Database can still
 * do so (metricsRepository.test.ts imports Database directly and constructs
 * a real instance), while tests that merely import modules which happen to
 * import better-sqlite3 at module scope don't crash.
 *
 * IMPORTANT: metricsRepository.test.ts constructs `new Database(':memory:')`
 * directly, so this mock is intentionally a pass-through that re-exports
 * the real module when available, falling back to a stub when not.
 */

let RealDatabase: typeof import('better-sqlite3') | undefined;
try {
  // Try to load the real module (works when rebuilt for the current Node ABI,
  // e.g. in a local dev environment where @electron/rebuild was run for Node).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RealDatabase = require.requireActual('better-sqlite3');
} catch {
  RealDatabase = undefined;
}

if (RealDatabase) {
  module.exports = RealDatabase;
} else {
  // Full stub — used in CI where the binary is compiled for Electron ABI only
  interface StmtMock {
    run: jest.Mock;
    get: jest.Mock;
    all: jest.Mock;
  }

  const makeStmt = (): StmtMock => ({
    run: jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
    get: jest.fn().mockReturnValue(undefined),
    all: jest.fn().mockReturnValue([]),
  });

  class DatabaseMock {
    pragma  = jest.fn();
    exec    = jest.fn();
    close   = jest.fn();
    prepare = jest.fn().mockImplementation(() => makeStmt());
    transaction = jest.fn().mockImplementation((fn: () => void) => fn);
  }

  module.exports = DatabaseMock;
}
