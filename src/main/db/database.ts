import Database from 'better-sqlite3';
import * as path from 'path';
import {
  CREATE_NETWORK_METRICS,
  CREATE_NETWORK_METRICS_IDX_TIMESTAMP,
  CREATE_NETWORK_METRICS_IDX_ADAPTER,
  CREATE_AGGREGATED_METRICS,
  CREATE_AGGREGATED_IDX,
  CREATE_APP_CONFIG,
  DEFAULT_CONFIG,
} from './schema';

let db: Database.Database | null = null;

/**
 * Returns the singleton better-sqlite3 Database instance.
 * Throws if initDatabase() has not been called yet.
 */
export function getDb(): Database.Database {
  if (!db) throw new Error('[DB] Database not initialised. Call initDatabase() first.');
  return db;
}

/**
 * Opens (or creates) the SQLite database, enables WAL mode,
 * creates all tables and indexes, and seeds default config.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function initDatabase(): void {
  if (db) return; // already initialised

  // Lazy-require electron so this module can be imported in Jest without
  // needing a real Electron environment.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { app } = require('electron') as typeof import('electron');
  const dbPath = path.join(app.getPath('userData'), 'network-tracker.db');

  db = new Database(dbPath);

  // WAL mode: concurrent reads don't block writes
  db.pragma('journal_mode = WAL');
  // Enforce foreign key constraints
  db.pragma('foreign_keys = ON');
  // Reasonable cache size (4MB)
  db.pragma('cache_size = -4000');

  // Create schema
  db.exec(CREATE_NETWORK_METRICS);
  db.exec(CREATE_NETWORK_METRICS_IDX_TIMESTAMP);
  db.exec(CREATE_NETWORK_METRICS_IDX_ADAPTER);
  db.exec(CREATE_AGGREGATED_METRICS);
  db.exec(CREATE_AGGREGATED_IDX);
  db.exec(CREATE_APP_CONFIG);

  // Seed default config (ignore if keys already exist)
  const upsertConfig = db.prepare(
    `INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)`
  );
  const seedConfig = db.transaction(() => {
    for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
      upsertConfig.run(key, value);
    }
  });
  seedConfig();

  // eslint-disable-next-line no-console
  console.warn(`[DB] Opened: ${dbPath}`);
}

/**
 * Closes the database. Called on app quit.
 * Safe to call even if DB was never opened.
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * FOR TESTING ONLY — inject an in-memory database instance.
 */
export function _setDbForTest(instance: Database.Database): void {
  db = instance;
}
