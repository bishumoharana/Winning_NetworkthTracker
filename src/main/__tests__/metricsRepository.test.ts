/**
 * Unit tests for Task 2.2 — SQLite Persistence Layer
 * Uses an in-memory SQLite database for full isolation.
 */
import * as BetterSqlite3 from 'better-sqlite3';
const Database = (BetterSqlite3 as any).default ?? BetterSqlite3;
import { _setDbForTest } from '../db/database';
import {
  insertMetric,
  insertMetricsBatch,
  queryMetrics,
  deleteOldMetrics,
  getMetricsSummary,
} from '../db/metricsRepository';
import {
  insertAggregated,
  queryAggregated,
  deleteOldAggregated,
} from '../db/aggregatedRepository';
import {
  CREATE_NETWORK_METRICS,
  CREATE_NETWORK_METRICS_IDX_TIMESTAMP,
  CREATE_NETWORK_METRICS_IDX_ADAPTER,
  CREATE_AGGREGATED_METRICS,
  CREATE_AGGREGATED_IDX,
} from '../db/schema';
import { NetworkMetric, AggregatedMetric } from '../../shared/types';

// -------------------------------------------------------------------------
// Test setup: in-memory DB, recreated before each test
// -------------------------------------------------------------------------
beforeEach(() => {
  const mem = new Database(':memory:');
  mem.pragma('journal_mode = WAL');
  mem.exec(CREATE_NETWORK_METRICS);
  mem.exec(CREATE_NETWORK_METRICS_IDX_TIMESTAMP);
  mem.exec(CREATE_NETWORK_METRICS_IDX_ADAPTER);
  mem.exec(CREATE_AGGREGATED_METRICS);
  mem.exec(CREATE_AGGREGATED_IDX);
  _setDbForTest(mem);
});

// -------------------------------------------------------------------------
// Helper factories
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

function makeAgg(overrides: Partial<AggregatedMetric> = {}): AggregatedMetric {
  const now = Date.now();
  return {
    adapterName:   'eth0',
    intervalStart: now - 7200_000,
    intervalEnd:   now,
    totalSent:     1_000_000,
    totalReceived: 5_000_000,
    avgSpeedUp:    139,
    avgSpeedDown:  694,
    peakSpeedUp:   2_000_000,
    peakSpeedDown: 8_000_000,
    ...overrides,
  };
}

// -------------------------------------------------------------------------
// insertMetric / queryMetrics
// -------------------------------------------------------------------------
describe('insertMetric + queryMetrics', () => {
  it('inserts a metric and retrieves it', () => {
    insertMetric(makeMetric({ adapterName: 'eth0', bytesSent: 500 }));
    const results = queryMetrics({ adapterName: 'eth0' });
    expect(results).toHaveLength(1);
    expect(results[0].adapterName).toBe('eth0');
    expect(results[0].bytesSent).toBe(500);
  });

  it('returns empty array when table is empty', () => {
    expect(queryMetrics()).toHaveLength(0);
  });

  it('filters by adapter name', () => {
    insertMetric(makeMetric({ adapterName: 'eth0' }));
    insertMetric(makeMetric({ adapterName: 'wlan0' }));
    const eth = queryMetrics({ adapterName: 'eth0' });
    expect(eth).toHaveLength(1);
    expect(eth[0].adapterName).toBe('eth0');
  });

  it('filters by time range (since / until)', () => {
    const t = Date.now();
    insertMetric(makeMetric({ timestamp: t - 5000 })); // old
    insertMetric(makeMetric({ timestamp: t }));         // recent
    const recent = queryMetrics({ since: t - 1000 });
    expect(recent).toHaveLength(1);
    expect(recent[0].timestamp).toBeGreaterThanOrEqual(t - 1000);
  });

  it('respects the limit parameter', () => {
    for (let i = 0; i < 5; i++) insertMetric(makeMetric());
    const limited = queryMetrics({ limit: 3 });
    expect(limited).toHaveLength(3);
  });
});

// -------------------------------------------------------------------------
// insertMetricsBatch
// -------------------------------------------------------------------------
describe('insertMetricsBatch', () => {
  it('inserts multiple rows in one transaction', () => {
    const batch = [
      makeMetric({ adapterName: 'eth0', bytesSent: 100 }),
      makeMetric({ adapterName: 'eth0', bytesSent: 200 }),
      makeMetric({ adapterName: 'wlan0', bytesSent: 300 }),
    ];
    insertMetricsBatch(batch);
    expect(queryMetrics()).toHaveLength(3);
  });

  it('is a no-op for an empty array', () => {
    insertMetricsBatch([]);
    expect(queryMetrics()).toHaveLength(0);
  });
});

// -------------------------------------------------------------------------
// deleteOldMetrics
// -------------------------------------------------------------------------
describe('deleteOldMetrics', () => {
  it('deletes rows older than the threshold', () => {
    const now = Date.now();
    insertMetric(makeMetric({ timestamp: now - 10_000 })); // old
    insertMetric(makeMetric({ timestamp: now }));           // recent
    const deleted = deleteOldMetrics(now - 5_000);
    expect(deleted).toBe(1);
    expect(queryMetrics()).toHaveLength(1);
  });

  it('returns 0 when nothing to delete', () => {
    insertMetric(makeMetric({ timestamp: Date.now() }));
    expect(deleteOldMetrics(Date.now() - 86_400_000)).toBe(0);
  });
});

// -------------------------------------------------------------------------
// getMetricsSummary
// -------------------------------------------------------------------------
describe('getMetricsSummary', () => {
  it('sums bytes and finds peak speeds', () => {
    const now = Date.now();
    insertMetric(makeMetric({ adapterName: 'eth0', bytesSent: 1000, bytesReceived: 2000, speedUp: 100, speedDown: 200 }));
    insertMetric(makeMetric({ adapterName: 'eth0', bytesSent: 3000, bytesReceived: 4000, speedUp: 500, speedDown: 800 }));
    const summary = getMetricsSummary('eth0', now - 60_000, now + 60_000);
    expect(summary.totalSent).toBe(4000);
    expect(summary.totalReceived).toBe(6000);
    expect(summary.peakSpeedUp).toBe(500);
    expect(summary.peakSpeedDown).toBe(800);
    expect(summary.rowCount).toBe(2);
  });

  it('returns zero summary for unknown adapter', () => {
    const summary = getMetricsSummary('ghost0', 0, Date.now());
    expect(summary.totalSent).toBe(0);
    expect(summary.rowCount).toBe(0);
  });
});

// -------------------------------------------------------------------------
// aggregatedRepository
// -------------------------------------------------------------------------
describe('insertAggregated + queryAggregated', () => {
  it('inserts and retrieves an aggregated row', () => {
    insertAggregated(makeAgg({ adapterName: 'eth0' }));
    const rows = queryAggregated({ adapterName: 'eth0' });
    expect(rows).toHaveLength(1);
    expect(rows[0].adapterName).toBe('eth0');
    expect(rows[0].totalSent).toBe(1_000_000);
  });

  it('upserts (INSERT OR REPLACE) on duplicate adapter + interval_start', () => {
    const base = makeAgg({ adapterName: 'eth0', totalSent: 100 });
    insertAggregated(base);
    insertAggregated({ ...base, totalSent: 999 });
    const rows = queryAggregated({ adapterName: 'eth0' });
    expect(rows).toHaveLength(1);
    expect(rows[0].totalSent).toBe(999);
  });

  it('deleteOldAggregated removes rows by interval_end', () => {
    const now = Date.now();
    insertAggregated(makeAgg({ intervalEnd: now - 10_000 }));
    const deleted = deleteOldAggregated(now - 5_000);
    expect(deleted).toBe(1);
    expect(queryAggregated()).toHaveLength(0);
  });
});
