/**
 * Jest mock for better-sqlite3.
 *
 * better-sqlite3 compiles its native binary against the Electron ABI.
 * When Jest runs in plain Node the ABIs do not match and loading the real
 * binary crashes immediately with "was compiled against a different Node.js
 * version".
 *
 * Strategy:
 *   - Try jest.requireActual('better-sqlite3') — works when the binary has
 *     been rebuilt for the current Node ABI (local dev after @electron/rebuild).
 *   - Fall back to an in-memory stub for CI where only the Electron ABI binary
 *     is present.
 *
 * NOTE: The correct Jest API is jest.requireActual(), NOT require.requireActual()
 * which does not exist and always throws.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

let RealDatabase: any;
try {
  RealDatabase = jest.requireActual('better-sqlite3');
} catch {
  RealDatabase = null;
}

if (RealDatabase) {
  module.exports = RealDatabase;
} else {
  // ── Stub used in CI ────────────────────────────────────────────────────
  const makeStmt = () => ({
    run:  jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
    get:  jest.fn().mockReturnValue(undefined),
    all:  jest.fn().mockReturnValue([]),
    pluck: jest.fn().mockReturnThis(),
    bind: jest.fn().mockReturnThis(),
  });

  class DatabaseStub {
    pragma      = jest.fn();
    exec        = jest.fn();
    close       = jest.fn();
    prepare     = jest.fn().mockImplementation(() => makeStmt());
    transaction = jest.fn().mockImplementation((fn: (...args: any[]) => any) => fn);
  }

  module.exports = DatabaseStub;
}
