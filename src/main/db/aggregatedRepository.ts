import { getDb } from './database';
import { AggregatedMetric } from '../../shared/types';

interface AggRow {
  id: number;
  adapter_name:    string;
  interval_start:  number;
  interval_end:    number;
  total_sent:      number;
  total_received:  number;
  avg_speed_up:    number;
  avg_speed_down:  number;
  peak_speed_up:   number;
  peak_speed_down: number;
}

function rowToAgg(row: AggRow): AggregatedMetric {
  return {
    adapterName:   row.adapter_name,
    intervalStart: row.interval_start,
    intervalEnd:   row.interval_end,
    totalSent:     row.total_sent,
    totalReceived: row.total_received,
    avgSpeedUp:    row.avg_speed_up,
    avgSpeedDown:  row.avg_speed_down,
    peakSpeedUp:   row.peak_speed_up,
    peakSpeedDown: row.peak_speed_down,
  };
}

/**
 * Insert or replace an aggregated metric row.
 * Uses INSERT OR REPLACE — UNIQUE constraint on (adapter_name, interval_start).
 */
export function insertAggregated(metric: AggregatedMetric): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO aggregated_metrics
      (adapter_name, interval_start, interval_end,
       total_sent, total_received,
       avg_speed_up, avg_speed_down,
       peak_speed_up, peak_speed_down)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    metric.adapterName,
    metric.intervalStart,
    metric.intervalEnd,
    metric.totalSent,
    metric.totalReceived,
    metric.avgSpeedUp,
    metric.avgSpeedDown,
    metric.peakSpeedUp,
    metric.peakSpeedDown,
  );
}

export interface AggregatedQuery {
  adapterName?: string;
  since?:       number;
  until?:       number;
}

/** Query aggregated metrics with optional adapter + time range filters. */
export function queryAggregated(query: AggregatedQuery = {}): AggregatedMetric[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (query.adapterName) {
    conditions.push('adapter_name = ?');
    params.push(query.adapterName);
  }
  if (query.since !== undefined) {
    conditions.push('interval_start >= ?');
    params.push(query.since);
  }
  if (query.until !== undefined) {
    conditions.push('interval_end <= ?');
    params.push(query.until);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(
    `SELECT * FROM aggregated_metrics ${where} ORDER BY interval_start DESC`
  ).all(...params) as AggRow[];

  return rows.map(rowToAgg);
}

/** Delete aggregated rows with interval_end older than the given epoch ms. */
export function deleteOldAggregated(olderThanMs: number): number {
  const db = getDb();
  const result = db.prepare(
    `DELETE FROM aggregated_metrics WHERE interval_end < ?`
  ).run(olderThanMs);
  return result.changes;
}
