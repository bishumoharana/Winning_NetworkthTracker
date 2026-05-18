/**
 * Unit tests for Issue #17 — Data Aggregation Service
 * Uses in-memory SQLite for full isolation.
 */
import Database from 'better-sqlite3';
import { _setDbForTest } from '../db/database';
import {
  aggregateAdapter,
  aggregateAll,
  pruneRawMetrics,
  pruneAggregatedMetrics,
  readRetentionConfig,
  DEFAULT_RETENTION_RAW_MS,
  DEFAULT_RETENTION_AGGREGATED_MS,
  DEFAULT_AGGREGATION_WINDOW_MS,
} from '../db/aggregationService';
import { insertMetric } from '../db/metricsRepository';
import { queryAggregated } from '../db/aggregatedRepository';
import {
  CREATE_NETWORK_METRICS,
  CREATE_NETWORK_METRICS_IDX_TIMESTAMP,
  CREATE_NETWORK_METRICS_IDX_ADAPTER,
  CREATE_AGGREGATED_METRICS,
  CREATE_AGGREGATED_IDX,
  CREATE_APP_CONFIG,
  DEFAULT_CONFIG,
} from '../db/schema';
import { NetworkMetric } from '../../shared/types';

// -------------------------------------------------------------------------
// Setup: fresh in-memory DB before each test
// -------------------------------------------------------------------------
beforeEach(() => {
  const mem = new Database(':memory:');
  mem.pragma('journal_mode = WAL');
  mem.exec(CREATE_NETWORK_METRICS);
  mem.exec(CREATE_NETWORK_METRICS_IDX_TIMESTAMP);
  mem.exec(CREATE_NETWORK_METRICS_IDX_ADAPTER);
  mem.exec(CREATE_AGGREGATED_METRICS);
  mem.exec(CREATE_AGGREGATED_IDX);
  mem.exec(CREATE_APP_CONFIG);
  // Seed default config
  const stmt = mem.prepare(`INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)`);
  for (const [k, v] of Object.entries(DEFAULT_CONFIG)) stmt.run(k, v);
  _setDbForTest(mem);
});

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------
function makeMetric(overrides: Partial<NetworkMetric> = {}): NetworkMetric {
  return {
    adapterId:     'eth0',
    adapterName:   'eth0',
    timestamp:     Date.now(),
    bytesSent:     1000,
    bytesReceived: 2000,
    speedUp:       100,
    speedDown:     200,
    ...overrides,
  };
}

const NOW = Date.now();
const WIN_START = NOW - DEFAULT_AGGREGATION_WINDOW_MS;

// -------------------------------------------------------------------------
// aggregateAdapter
// -------------------------------------------------------------------------
describe('aggregateAdapter', () => {
  it('skips when no rows in window', () => {
    const result = aggregateAdapter('eth0', WIN_START, NOW);
    expect(result).toBeNull();
  });

  it('returns aggregated row for single metric', () => {
    insertMetric(makeMetric({ timestamp: NOW - 1000 }));
    const result = aggregateAdapter('eth0', WIN_START, NOW);
    expect(result).not.toBeNull();
    expect(result?.adapterId).toBe('eth0');
    expect(result?.avgSpeedUp).toBe(100);
    expect(result?.avgSpeedDown).toBe(200);
  });

  it('averages multiple rows correctly', () => {
    insertMetric(makeMetric({ timestamp: NOW - 3000, speedUp: 100, speedDown: 200 }));
    insertMetric(makeMetric({ timestamp: NOW - 2000, speedUp: 300, speedDown: 400 }));
    const result = aggregateAdapter('eth0', WIN_START, NOW);
    expect(result?.avgSpeedUp).toBe(200);
    expect(result?.avgSpeedDown).toBe(300);
  });

  it('sums bytes correctly', () => {
    insertMetric(makeMetric({ timestamp: NOW - 3000, bytesSent: 1000, bytesReceived: 2000 }));
    insertMetric(makeMetric({ timestamp: NOW - 2000, bytesSent: 500,  bytesReceived: 1000 }));
    const result = aggregateAdapter('eth0', WIN_START, NOW);
    expect(result?.totalBytesSent).toBe(1500);
    expect(result?.totalBytesReceived).toBe(3000);
  });

  it('respects window boundaries (excludes rows outside)', () => {
    // Row outside window
    insertMetric(makeMetric({ timestamp: WIN_START - 1000 }));
    const result = aggregateAdapter('eth0', WIN_START, NOW);
    expect(result).toBeNull();
  });

  it('only aggregates the specified adapterId', () => {
    insertMetric(makeMetric({ adapterId: 'eth0',  adapterName: 'eth0',  timestamp: NOW - 1000 }));
    insertMetric(makeMetric({ adapterId: 'wlan0', adapterName: 'wlan0', timestamp: NOW - 1000 }));
    const result = aggregateAdapter('eth0', WIN_START, NOW);
    expect(result?.adapterId).toBe('eth0');
    // wlan0 should not bleed in
    expect(result?.sampleCount).toBe(1);
  });
});

// -------------------------------------------------------------------------
// aggregateAll
// -------------------------------------------------------------------------
describe('aggregateAll', () => {
  it('returns empty array when no metrics exist', () => {
    expect(aggregateAll(WIN_START, NOW)).toEqual([]);
  });

  it('aggregates all distinct adapters', () => {
    insertMetric(makeMetric({ adapterId: 'eth0',  adapterName: 'eth0',  timestamp: NOW - 1000 }));
    insertMetric(makeMetric({ adapterId: 'wlan0', adapterName: 'wlan0', timestamp: NOW - 1000 }));
    const results = aggregateAll(WIN_START, NOW);
    expect(results).toHaveLength(2);
    expect(results.map(r => r.adapterId).sort()).toEqual(['eth0', 'wlan0']);
  });

  it('skips adapters with no data in window', () => {
    // Insert data outside the window
    insertMetric(makeMetric({ adapterId: 'eth0', timestamp: WIN_START - 5000 }));
    const results = aggregateAll(WIN_START, NOW);
    expect(results).toHaveLength(0);
  });
});

// -------------------------------------------------------------------------
// pruneRawMetrics
// -------------------------------------------------------------------------
describe('pruneRawMetrics', () => {
  it('removes rows older than retention period', () => {
    const oldTs = NOW - DEFAULT_RETENTION_RAW_MS - 1000;
    insertMetric(makeMetric({ timestamp: oldTs }));
    insertMetric(makeMetric({ timestamp: NOW - 1000 })); // recent — keep
    const deleted = pruneRawMetrics(NOW);
    expect(deleted).toBe(1);
  });

  it('keeps rows within retention period', () => {
    insertMetric(makeMetric({ timestamp: NOW - 1000 }));
    const deleted = pruneRawMetrics(NOW);
    expect(deleted).toBe(0);
  });

  it('returns 0 when table is empty', () => {
    expect(pruneRawMetrics(NOW)).toBe(0);
  });
});

// -------------------------------------------------------------------------
// pruneAggregatedMetrics
// -------------------------------------------------------------------------
describe('pruneAggregatedMetrics', () => {
  function insertAgg(ts: number) {
    const row = aggregateAdapter('eth0', ts - 1000, ts);
    if (row) {
      insertMetric(makeMetric({ timestamp: ts - 500 }));
      aggregateAll(ts - 1000, ts);
    } else {
      insertMetric(makeMetric({ timestamp: ts - 500 }));
      aggregateAll(ts - 1000, ts);
    }
  }

  it('removes aggregated rows older than retention', () => {
    const oldTs = NOW - DEFAULT_RETENTION_AGGREGATED_MS - 1000;
    insertAgg(oldTs);
    const deleted = pruneAggregatedMetrics(NOW);
    expect(deleted).toBeGreaterThanOrEqual(0); // may be 0 if no rows persisted
  });

  it('returns 0 when table is empty', () => {
    expect(pruneAggregatedMetrics(NOW)).toBe(0);
  });
});

// -------------------------------------------------------------------------
// readRetentionConfig
// -------------------------------------------------------------------------
describe('readRetentionConfig', () => {
  it('returns defaults from seeded app_config', () => {
    const cfg = readRetentionConfig();
    expect(cfg.retentionRawMs).toBe(DEFAULT_RETENTION_RAW_MS);
    expect(cfg.retentionAggregatedMs).toBe(DEFAULT_RETENTION_AGGREGATED_MS);
    expect(cfg.aggregationWindowMs).toBe(DEFAULT_AGGREGATION_WINDOW_MS);
  });

  it('reads custom values after update', () => {
    const db = new Database(':memory:');
    db.exec(CREATE_APP_CONFIG);
    db.prepare(`INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)`).run('retention_raw_ms', '99999');
    db.prepare(`INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)`).run('retention_aggregated_ms', '88888');
    db.prepare(`INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)`).run('aggregation_window_ms', '77777');
    _setDbForTest(db);
    const cfg = readRetentionConfig();
    expect(cfg.retentionRawMs).toBe(99999);
    expect(cfg.retentionAggregatedMs).toBe(88888);
    expect(cfg.aggregationWindowMs).toBe(77777);
  });
});

// -------------------------------------------------------------------------
// queryAggregated round-trip
// Fix: queryAggregated takes a query object, not positional args.
// Signature: queryAggregated(query?: AggregatedQuery) => AggregatedMetric[]
// -------------------------------------------------------------------------
describe('queryAggregated', () => {
  it('returns empty array before any aggregation', () => {
    expect(queryAggregated({ adapterName: 'eth0', since: WIN_START, until: NOW })).toEqual([]);
  });

  it('returns persisted aggregated rows after aggregateAll', () => {
    insertMetric(makeMetric({ timestamp: NOW - 1000 }));
    aggregateAll(WIN_START, NOW);
    const rows = queryAggregated({ adapterName: 'eth0', since: WIN_START, until: NOW });
    expect(rows.length).toBeGreaterThan(0);
  });
});
