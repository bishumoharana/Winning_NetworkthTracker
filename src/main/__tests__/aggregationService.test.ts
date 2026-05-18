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
    expect(result.skipped).toBe(true);
    expect(result.rowCount).toBe(0);
    expect(queryAggregated()).toHaveLength(0);
  });

  it('aggregates a single row correctly', () => {
    insertMetric(makeMetric({
      adapterName: 'eth0', timestamp: NOW - 1000,
      bytesSent: 500, bytesReceived: 1000, speedUp: 50, speedDown: 100,
    }));
    const result = aggregateAdapter('eth0', WIN_START, NOW);
    expect(result.skipped).toBe(false);
    expect(result.rowCount).toBe(1);
    const aggs = queryAggregated({ adapterName: 'eth0' });
    expect(aggs).toHaveLength(1);
    expect(aggs[0].totalSent).toBe(500);
    expect(aggs[0].totalReceived).toBe(1000);
    expect(aggs[0].peakSpeedUp).toBe(50);
    expect(aggs[0].peakSpeedDown).toBe(100);
    expect(aggs[0].avgSpeedUp).toBe(50);
    expect(aggs[0].avgSpeedDown).toBe(100);
  });

  it('computes correct avg and peak over multiple rows', () => {
    insertMetric(makeMetric({ adapterName: 'eth0', timestamp: NOW - 3000, speedUp: 100, speedDown: 200 }));
    insertMetric(makeMetric({ adapterName: 'eth0', timestamp: NOW - 2000, speedUp: 300, speedDown: 400 }));
    insertMetric(makeMetric({ adapterName: 'eth0', timestamp: NOW - 1000, speedUp: 200, speedDown: 100 }));
    aggregateAdapter('eth0', WIN_START, NOW);
    const aggs = queryAggregated({ adapterName: 'eth0' });
    expect(aggs[0].avgSpeedUp).toBeCloseTo((100 + 300 + 200) / 3);
    expect(aggs[0].avgSpeedDown).toBeCloseTo((200 + 400 + 100) / 3);
    expect(aggs[0].peakSpeedUp).toBe(300);
    expect(aggs[0].peakSpeedDown).toBe(400);
  });

  it('sums bytes correctly', () => {
    insertMetric(makeMetric({ adapterName: 'eth0', timestamp: NOW - 2000, bytesSent: 1000, bytesReceived: 2000 }));
    insertMetric(makeMetric({ adapterName: 'eth0', timestamp: NOW - 1000, bytesSent: 3000, bytesReceived: 4000 }));
    aggregateAdapter('eth0', WIN_START, NOW);
    const aggs = queryAggregated({ adapterName: 'eth0' });
    expect(aggs[0].totalSent).toBe(4000);
    expect(aggs[0].totalReceived).toBe(6000);
  });

  it('only includes rows within the window', () => {
    // Outside window
    insertMetric(makeMetric({ adapterName: 'eth0', timestamp: WIN_START - 10_000 }));
    // Inside window
    insertMetric(makeMetric({ adapterName: 'eth0', timestamp: NOW - 1000, speedUp: 999 }));
    const result = aggregateAdapter('eth0', WIN_START, NOW);
    expect(result.rowCount).toBe(1);
    expect(queryAggregated()[0].peakSpeedUp).toBe(999);
  });

  it('upserts on repeated calls for the same window', () => {
    insertMetric(makeMetric({ adapterName: 'eth0', timestamp: NOW - 1000, speedUp: 50 }));
    aggregateAdapter('eth0', WIN_START, NOW);
    // Second call — same window, higher speed
    insertMetric(makeMetric({ adapterName: 'eth0', timestamp: NOW - 500, speedUp: 999 }));
    aggregateAdapter('eth0', WIN_START, NOW);
    expect(queryAggregated({ adapterName: 'eth0' })).toHaveLength(1);
  });
});

// -------------------------------------------------------------------------
// aggregateAll
// -------------------------------------------------------------------------
describe('aggregateAll', () => {
  it('returns empty array when no rows', () => {
    expect(aggregateAll()).toHaveLength(0);
  });

  it('processes all distinct adapters', () => {
    insertMetric(makeMetric({ adapterName: 'eth0',  timestamp: NOW - 1000 }));
    insertMetric(makeMetric({ adapterName: 'wlan0', timestamp: NOW - 1000 }));
    insertMetric(makeMetric({ adapterName: 'lo',    timestamp: NOW - 1000 }));
    const results = aggregateAll();
    expect(results).toHaveLength(3);
    expect(results.every(r => !r.skipped)).toBe(true);
  });

  it('does not process adapters with no rows in window', () => {
    // Old row outside default 2h window
    insertMetric(makeMetric({ adapterName: 'eth0', timestamp: NOW - DEFAULT_AGGREGATION_WINDOW_MS - 10_000 }));
    const results = aggregateAll();
    expect(results).toHaveLength(0);
  });
});

// -------------------------------------------------------------------------
// pruneRawMetrics
// -------------------------------------------------------------------------
describe('pruneRawMetrics', () => {
  it('deletes rows beyond retention period', () => {
    const sevenDaysAgo = NOW - DEFAULT_RETENTION_RAW_MS - 1000;
    insertMetric(makeMetric({ timestamp: sevenDaysAgo }));
    insertMetric(makeMetric({ timestamp: NOW }));
    const deleted = pruneRawMetrics();
    expect(deleted).toBe(1);
  });

  it('does not delete recent rows', () => {
    insertMetric(makeMetric({ timestamp: NOW - 1000 }));
    expect(pruneRawMetrics()).toBe(0);
  });
});

// -------------------------------------------------------------------------
// pruneAggregatedMetrics
// -------------------------------------------------------------------------
describe('pruneAggregatedMetrics', () => {
  it('deletes aggregated rows beyond retention period', () => {
    const { insertAggregated } = require('../db/aggregatedRepository');
    const oldEnd = NOW - DEFAULT_RETENTION_AGGREGATED_MS - 1000;
    insertAggregated({
      adapterName: 'eth0', intervalStart: oldEnd - 7200_000, intervalEnd: oldEnd,
      totalSent: 0, totalReceived: 0, avgSpeedUp: 0, avgSpeedDown: 0, peakSpeedUp: 0, peakSpeedDown: 0,
    });
    expect(pruneAggregatedMetrics()).toBe(1);
  });

  it('does not delete recent aggregated rows', () => {
    const { insertAggregated } = require('../db/aggregatedRepository');
    insertAggregated({
      adapterName: 'eth0', intervalStart: NOW - 7200_000, intervalEnd: NOW,
      totalSent: 0, totalReceived: 0, avgSpeedUp: 0, avgSpeedDown: 0, peakSpeedUp: 0, peakSpeedDown: 0,
    });
    expect(pruneAggregatedMetrics()).toBe(0);
  });
});

// -------------------------------------------------------------------------
// readRetentionConfig
// -------------------------------------------------------------------------
describe('readRetentionConfig', () => {
  it('reads default config values correctly', () => {
    const cfg = readRetentionConfig();
    expect(cfg.retentionRawMs).toBe(7 * 24 * 60 * 60 * 1000);
    expect(cfg.retentionAggregatedMs).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it('reflects updated config values', () => {
    const db = require('../db/database').getDb();
    db.prepare(`UPDATE app_config SET value = '14' WHERE key = 'retentionDaysRaw'`).run();
    const cfg = readRetentionConfig();
    expect(cfg.retentionRawMs).toBe(14 * 24 * 60 * 60 * 1000);
  });
});
