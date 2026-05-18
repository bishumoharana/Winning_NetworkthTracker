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
 *     been rebuilt for the current Node ABI (local dev after @electron/rebuild,
 *     or CI after the rebuild step succeeds).
 *   - Fall back to an in-memory stub for CI where only the Electron ABI binary
 *     is present.
 *
 * ESM-interop fix:
 *   With esModuleInterop:true, ts-jest compiles
 *     import Database from 'better-sqlite3'
 *   into
 *     const Database = better_sqlite3_1.default
 *
 *   The real better-sqlite3 CJS module exports the constructor as
 *   module.exports = Database (no .default property), so .default is
 *   undefined and `new Database()` throws "is not a constructor".
 *
 *   Fix: after requireActual, if .default is not already set, assign it
 *   so both import styles resolve to the constructor.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

let RealDatabase: any;
try {
  RealDatabase = jest.requireActual('better-sqlite3');
} catch {
  RealDatabase = null;
}

if (RealDatabase) {
  // Patch .default so esModuleInterop `import Database from 'better-sqlite3'`
  // resolves correctly.  The check avoids double-patching if already present.
  if (!RealDatabase.default) {
    RealDatabase.default = RealDatabase;
  }
  module.exports = RealDatabase;
} else {
  // ── Stub used in CI ────────────────────────────────────────────────────
  const makeStmt = () => ({
    run:   jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
    get:   jest.fn().mockReturnValue(undefined),
    all:   jest.fn().mockReturnValue([]),
    pluck: jest.fn().mockReturnThis(),
    bind:  jest.fn().mockReturnThis(),
  });

  class DatabaseStub {
    pragma      = jest.fn();
    exec        = jest.fn();
    close       = jest.fn();
    prepare     = jest.fn().mockImplementation(() => makeStmt());
    transaction = jest.fn().mockImplementation((fn: (...args: any[]) => any) => fn);
  }

  // Export as both default and named so that:
  //   import Database from 'better-sqlite3'          (ESM default)
  //   const Database = require('better-sqlite3')      (CJS)
  // both resolve to the constructor.
  (DatabaseStub as any).default = DatabaseStub;
  module.exports = DatabaseStub;
}
