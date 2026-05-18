/**
 * Data Aggregation Service — Issue #17
 *
 * Reads raw network_metrics over a configurable window (default 2h),
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

interface RetentionConfig {
  retentionRawMs:        number;
  retentionAggregatedMs: number;
}

/** Reads retention config from app_config table. Falls back to defaults. */
export function readRetentionConfig(): RetentionConfig {
  try {
    const db = getDb();
    const rawRow = db.prepare(
      `SELECT value FROM app_config WHERE key = 'retentionDaysRaw'`
    ).get() as { value: string } | undefined;
    const aggRow = db.prepare(
      `SELECT value FROM app_config WHERE key = 'retentionDaysAggregated'`
    ).get() as { value: string } | undefined;

    const rawDays = rawRow ? parseInt(rawRow.value, 10) : 7;
    const aggDays = aggRow ? parseInt(aggRow.value, 10) : 90;

    return {
      retentionRawMs:        (isNaN(rawDays) ? 7  : rawDays) * 24 * 60 * 60 * 1000,
      retentionAggregatedMs: (isNaN(aggDays) ? 90 : aggDays) * 24 * 60 * 60 * 1000,
    };
  } catch {
    return {
      retentionRawMs:        DEFAULT_RETENTION_RAW_MS,
      retentionAggregatedMs: DEFAULT_RETENTION_AGGREGATED_MS,
    };
  }
}

// ---------------------------------------------------------------------------
// Core aggregation
// ---------------------------------------------------------------------------

export interface AggregationResult {
  adapter:    string;
  rowCount:   number;
  windowMs:   number;
  skipped:    boolean; // true if no rows found for this adapter/window
}

/**
 * Aggregates raw metrics for one adapter over [windowStart, windowEnd].
 * Writes a single row to aggregated_metrics.
 * Returns a summary of what was done.
 */
export function aggregateAdapter(
  adapterName: string,
  windowStart: number,
  windowEnd:   number,
): AggregationResult {
  const rows: NetworkMetric[] = queryMetrics({
    adapterName,
    since: windowStart,
    until: windowEnd,
    limit: 100_000, // safety cap
  });

  if (rows.length === 0) {
    return { adapter: adapterName, rowCount: 0, windowMs: windowEnd - windowStart, skipped: true };
  }

  let totalSent     = 0;
  let totalReceived = 0;
  let sumSpeedUp    = 0;
  let sumSpeedDown  = 0;
  let peakSpeedUp   = 0;
  let peakSpeedDown = 0;

  for (const r of rows) {
    totalSent     += r.bytesSent;
    totalReceived += r.bytesReceived;
    sumSpeedUp    += r.speedUp;
    sumSpeedDown  += r.speedDown;
    if (r.speedUp   > peakSpeedUp)   peakSpeedUp   = r.speedUp;
    if (r.speedDown > peakSpeedDown) peakSpeedDown = r.speedDown;
  }

  const n = rows.length;

  insertAggregated({
    adapterName,
    intervalStart: windowStart,
    intervalEnd:   windowEnd,
    totalSent,
    totalReceived,
    avgSpeedUp:    sumSpeedUp   / n,
    avgSpeedDown:  sumSpeedDown / n,
    peakSpeedUp,
    peakSpeedDown,
  });

  return { adapter: adapterName, rowCount: n, windowMs: windowEnd - windowStart, skipped: false };
}

/**
 * Aggregates all distinct adapters seen within the aggregation window.
 * Window = [now - windowMs, now].
 */
export function aggregateAll(
  windowMs = DEFAULT_AGGREGATION_WINDOW_MS,
): AggregationResult[] {
  const windowEnd   = Date.now();
  const windowStart = windowEnd - windowMs;

  // Find distinct adapters active in this window
  const db = getDb();
  const adapters = (db.prepare(
    `SELECT DISTINCT adapter_name FROM network_metrics WHERE timestamp >= ? AND timestamp <= ?`
  ).all(windowStart, windowEnd) as Array<{ adapter_name: string }>)
    .map(r => r.adapter_name);

  const results: AggregationResult[] = [];
  for (const adapter of adapters) {
    results.push(aggregateAdapter(adapter, windowStart, windowEnd));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Pruning
// ---------------------------------------------------------------------------

/** Deletes raw metric rows older than retentionRawMs from now. */
export function pruneRawMetrics(retentionRawMs = DEFAULT_RETENTION_RAW_MS): number {
  const cutoff = Date.now() - retentionRawMs;
  return deleteOldMetrics(cutoff);
}

/** Deletes aggregated metric rows older than retentionAggregatedMs from now. */
export function pruneAggregatedMetrics(retentionAggregatedMs = DEFAULT_RETENTION_AGGREGATED_MS): number {
  const cutoff = Date.now() - retentionAggregatedMs;
  return deleteOldAggregated(cutoff);
}

/**
 * Convenience: aggregate + prune in one call.
 * Reads retention config from DB.
 */
export function runAggregationCycle(): {
  aggregated: AggregationResult[];
  rawPruned:  number;
  aggPruned:  number;
} {
  const config     = readRetentionConfig();
  const aggregated = aggregateAll();
  const rawPruned  = pruneRawMetrics(config.retentionRawMs);
  const aggPruned  = pruneAggregatedMetrics(config.retentionAggregatedMs);
  return { aggregated, rawPruned, aggPruned };
}
