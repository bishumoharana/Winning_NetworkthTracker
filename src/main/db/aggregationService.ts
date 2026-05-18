/**
 * Data Aggregation Service — Issue #17
 *
 * Reads raw network_metrics over a configurable window,
 * computes totals / averages / peaks per adapter, writes to aggregated_metrics,
 * and prunes old data per the retention config.
 */
import { getDb } from './database';
import { queryMetrics } from './metricsRepository';
import { insertAggregated, deleteOldAggregated } from './aggregatedRepository';
import { deleteOldMetrics } from './metricsRepository';
import { NetworkMetric } from '../../shared/types';

// Default retention periods (ms)
export const DEFAULT_RETENTION_RAW_MS         = 7  * 24 * 60 * 60 * 1000; // 7 days
export const DEFAULT_RETENTION_AGGREGATED_MS  = 90 * 24 * 60 * 60 * 1000; // 90 days
export const DEFAULT_AGGREGATION_WINDOW_MS    = 2  * 60 * 60 * 1000;      // 2 hours

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

export interface RetentionConfig {
  retentionRawMs:        number;
  retentionAggregatedMs: number;
  aggregationWindowMs:   number;
}

/** Reads retention/aggregation config from app_config table. Falls back to defaults. */
export function readRetentionConfig(): RetentionConfig {
  try {
    const db = getDb();
    const get = (key: string): string | undefined =>
      (db.prepare(`SELECT value FROM app_config WHERE key = ?`).get(key) as { value: string } | undefined)?.value;

    const rawMs  = get('retention_raw_ms');
    const aggMs  = get('retention_aggregated_ms');
    const winMs  = get('aggregation_window_ms');

    // Also support legacy day-based keys for backwards compat
    const rawDays = get('retentionDaysRaw');
    const aggDays = get('retentionDaysAggregated');

    let retentionRawMs = DEFAULT_RETENTION_RAW_MS;
    let retentionAggregatedMs = DEFAULT_RETENTION_AGGREGATED_MS;
    let aggregationWindowMs = DEFAULT_AGGREGATION_WINDOW_MS;

    if (rawMs !== undefined) {
      retentionRawMs = parseInt(rawMs, 10) || DEFAULT_RETENTION_RAW_MS;
    } else if (rawDays !== undefined) {
      retentionRawMs = (parseInt(rawDays, 10) || 7) * 24 * 60 * 60 * 1000;
    }

    if (aggMs !== undefined) {
      retentionAggregatedMs = parseInt(aggMs, 10) || DEFAULT_RETENTION_AGGREGATED_MS;
    } else if (aggDays !== undefined) {
      retentionAggregatedMs = (parseInt(aggDays, 10) || 90) * 24 * 60 * 60 * 1000;
    }

    if (winMs !== undefined) {
      aggregationWindowMs = parseInt(winMs, 10) || DEFAULT_AGGREGATION_WINDOW_MS;
    }

    return { retentionRawMs, retentionAggregatedMs, aggregationWindowMs };
  } catch {
    return {
      retentionRawMs:        DEFAULT_RETENTION_RAW_MS,
      retentionAggregatedMs: DEFAULT_RETENTION_AGGREGATED_MS,
      aggregationWindowMs:   DEFAULT_AGGREGATION_WINDOW_MS,
    };
  }
}

// ---------------------------------------------------------------------------
// Core aggregation
// ---------------------------------------------------------------------------

export interface AggregationResult {
  adapterId:          string;
  sampleCount:        number;
  windowMs:           number;
  avgSpeedUp:         number;
  avgSpeedDown:       number;
  totalBytesSent:     number;
  totalBytesReceived: number;
  peakSpeedUp:        number;
  peakSpeedDown:      number;
}

/**
 * Aggregates raw metrics for one adapter over [windowStart, windowEnd].
 * Writes a single row to aggregated_metrics.
 * Returns an AggregationResult, or null if no rows found for this window.
 */
export function aggregateAdapter(
  adapterName: string,
  windowStart: number,
  windowEnd:   number,
): AggregationResult | null {
  const rows: NetworkMetric[] = queryMetrics({
    adapterName,
    since: windowStart,
    until: windowEnd,
    limit: 100_000,
  });

  if (rows.length === 0) {
    return null;
  }

  let totalBytesSent     = 0;
  let totalBytesReceived = 0;
  let sumSpeedUp         = 0;
  let sumSpeedDown       = 0;
  let peakSpeedUp        = 0;
  let peakSpeedDown      = 0;

  for (const r of rows) {
    totalBytesSent     += r.bytesSent;
    totalBytesReceived += r.bytesReceived;
    sumSpeedUp         += r.speedUp;
    sumSpeedDown       += r.speedDown;
    if (r.speedUp   > peakSpeedUp)   peakSpeedUp   = r.speedUp;
    if (r.speedDown > peakSpeedDown) peakSpeedDown = r.speedDown;
  }

  const n = rows.length;
  const avgSpeedUp   = sumSpeedUp   / n;
  const avgSpeedDown = sumSpeedDown / n;

  insertAggregated({
    adapterName,
    intervalStart: windowStart,
    intervalEnd:   windowEnd,
    totalSent:     totalBytesSent,
    totalReceived: totalBytesReceived,
    avgSpeedUp,
    avgSpeedDown,
    peakSpeedUp,
    peakSpeedDown,
  });

  return {
    adapterId:          adapterName,
    sampleCount:        n,
    windowMs:           windowEnd - windowStart,
    avgSpeedUp,
    avgSpeedDown,
    totalBytesSent,
    totalBytesReceived,
    peakSpeedUp,
    peakSpeedDown,
  };
}

/**
 * Aggregates all distinct adapters seen within [windowStart, windowEnd].
 * Returns only adapters that had data (null results are filtered out).
 */
export function aggregateAll(
  windowStart: number,
  windowEnd:   number,
): AggregationResult[] {
  const db = getDb();
  const adapters = (
    db.prepare(
      `SELECT DISTINCT adapter_name FROM network_metrics WHERE timestamp >= ? AND timestamp <= ?`
    ).all(windowStart, windowEnd) as Array<{ adapter_name: string }>
  ).map(r => r.adapter_name);

  const results: AggregationResult[] = [];
  for (const adapter of adapters) {
    const r = aggregateAdapter(adapter, windowStart, windowEnd);
    if (r !== null) results.push(r);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Pruning
// ---------------------------------------------------------------------------

/**
 * Deletes raw metric rows older than retentionRawMs before `now`.
 * @param now - reference timestamp (defaults to Date.now())
 */
export function pruneRawMetrics(
  now = Date.now(),
  retentionRawMs = DEFAULT_RETENTION_RAW_MS,
): number {
  const cutoff = now - retentionRawMs;
  return deleteOldMetrics(cutoff);
}

/**
 * Deletes aggregated metric rows older than retentionAggregatedMs before `now`.
 * @param now - reference timestamp (defaults to Date.now())
 */
export function pruneAggregatedMetrics(
  now = Date.now(),
  retentionAggregatedMs = DEFAULT_RETENTION_AGGREGATED_MS,
): number {
  const cutoff = now - retentionAggregatedMs;
  return deleteOldAggregated(cutoff);
}

/**
 * Convenience: aggregate + prune in one call.
 */
export function runAggregationCycle(): {
  aggregated: AggregationResult[];
  rawPruned:  number;
  aggPruned:  number;
} {
  const config      = readRetentionConfig();
  const now         = Date.now();
  const windowStart = now - config.aggregationWindowMs;
  const aggregated  = aggregateAll(windowStart, now);
  const rawPruned   = pruneRawMetrics(now, config.retentionRawMs);
  const aggPruned   = pruneAggregatedMetrics(now, config.retentionAggregatedMs);
  return { aggregated, rawPruned, aggPruned };
}
