/**
 * Jest mock for better-sqlite3.
 *
 * better-sqlite3 compiles its native binary against the Electron ABI.
 * When Jest runs in plain Node the ABIs do not match and loading the real
 * binary crashes immediately with "was compiled against a different Node.js
 * version".
 *
 * Strategy:
 *   1. Try jest.requireActual('better-sqlite3').
 *   2. If the module loads, do a canary instantiation (new DB(':memory:'))
 *      to confirm the binary actually works under the current Node ABI.
 *   3. If the canary succeeds → use the real module (local dev after
 *      rebuilding for Node, or CI where the Node ABI binary is present).
 *   4. If the canary throws for ANY reason (ABI mismatch, "is not a
 *      constructor", etc.) → fall through to the in-memory stub so that
 *      aggregationService / metricsRepository tests can run without a
 *      native binary.
 *
 * ESM-interop fix:
 *   With esModuleInterop:true, ts-jest compiles
 *     import Database from 'better-sqlite3'
 *   into
 *     const Database = better_sqlite3_1.default
 *
 *   The real better-sqlite3 CJS module exports the constructor as
 *   module.exports = Database (no .default property), so .default would be
 *   undefined and `new Database()` throws "is not a constructor".
 *
 *   Fix: after requireActual, if .default is not already set, assign it
 *   so both import styles resolve to the constructor.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Stub definition (used when the real binary is not usable) ─────────────

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

// Export stub as both default and named so:
//   import Database from 'better-sqlite3'   (ESM default / esModuleInterop)
//   const Database = require('better-sqlite3') (CJS)
// both resolve to the constructor.
(DatabaseStub as any).default = DatabaseStub;

// ── Attempt to use the real module ────────────────────────────────────────

let useReal = false;
let RealDatabase: any = null;

try {
  RealDatabase = jest.requireActual('better-sqlite3');

  if (RealDatabase) {
    // Patch .default for esModuleInterop if not already present.
    if (!RealDatabase.default) {
      RealDatabase.default = RealDatabase;
    }

    // Canary: actually open an in-memory database to confirm the native
    // binary is usable under the *current* Node ABI (not just the Electron
    // ABI that @electron/rebuild targets).  If this throws, we fall back to
    // the stub below.
    const Ctor = RealDatabase.default ?? RealDatabase;
    const canary = new Ctor(':memory:');
    canary.close();
    useReal = true;
  }
} catch {
  // Native binary is not usable in this environment (ABI mismatch, missing
  // file, etc.) — fall through to stub.
  useReal = false;
}

// ── Export ────────────────────────────────────────────────────────────────

if (useReal) {
  module.exports = RealDatabase;
} else {
  module.exports = DatabaseStub;
}
