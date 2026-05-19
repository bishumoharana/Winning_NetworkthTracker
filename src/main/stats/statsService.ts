/**
 * statsService — Issue #23
 *
 * Aggregates stored network_metrics into per-period summary statistics.
 * NOTE: network_metrics has no `adapter_id` column — the adapter
 * identifier is stored in `adapter_name`.  All queries use adapter_name.
 */
import { getDb } from '../db/database';

export type Period = 'day' | 'week' | 'month';

export interface StatsRow {
  adapterId:          string;
  adapterName:        string;
  period:             Period;
  totalBytesSent:     number;
  totalBytesReceived: number;
  peakSpeedUp:        number;
  peakSpeedDown:      number;
  avgSpeedUp:         number;
  avgSpeedDown:       number;
  sampleCount:        number;
}

export interface PeriodBounds {
  fromTs: number;
  toTs:   number;
}

/** Returns { fromTs, toTs } for the start/end of the requested period (local time). */
export function getPeriodBounds(period: Period, now = Date.now()): PeriodBounds {
  const d = new Date(now);

  if (period === 'day') {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    return { fromTs: start.getTime(), toTs: end.getTime() };
  }

  if (period === 'week') {
    const day   = d.getDay(); // 0=Sun
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day, 0, 0, 0, 0);
    const end   = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
    return { fromTs: start.getTime(), toTs: end.getTime() };
  }

  // month
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return { fromTs: start.getTime(), toTs: end.getTime() };
}

/**
 * Returns per-adapter aggregated stats for the given period.
 * Optionally filtered to a single adapterId (matched against adapter_name).
 * `now` defaults to Date.now() — pass a fixed value in tests for determinism.
 */
export function getStats(period: Period, adapterId?: string, now = Date.now()): StatsRow[] {
  const db                  = getDb();
  const { fromTs, toTs }    = getPeriodBounds(period, now);
  const conditions: string[] = ['timestamp >= ?', 'timestamp <= ?'];
  const params: unknown[]    = [fromTs, toTs];

  if (adapterId) {
    conditions.push('adapter_name = ?');
    params.push(adapterId);
  }

  const where = conditions.join(' AND ');
  const sql = `
    SELECT
      adapter_name                     AS adapterId,
      adapter_name                     AS adapterName,
      SUM(bytes_sent)                  AS totalBytesSent,
      SUM(bytes_received)              AS totalBytesReceived,
      MAX(speed_up)                    AS peakSpeedUp,
      MAX(speed_down)                  AS peakSpeedDown,
      CAST(AVG(speed_up)   AS INTEGER) AS avgSpeedUp,
      CAST(AVG(speed_down) AS INTEGER) AS avgSpeedDown,
      COUNT(*)                         AS sampleCount
    FROM network_metrics
    WHERE ${where}
    GROUP BY adapter_name
    ORDER BY adapter_name ASC
  `;

  const rows = db.prepare(sql).all(...params) as {
    adapterId: string; adapterName: string;
    totalBytesSent: number; totalBytesReceived: number;
    peakSpeedUp: number; peakSpeedDown: number;
    avgSpeedUp: number; avgSpeedDown: number;
    sampleCount: number;
  }[];

  return rows.map(r => ({ ...r, period }));
}

/**
 * Returns a single rolled-up summary across ALL adapters for the period.
 * `now` defaults to Date.now() — pass a fixed value in tests for determinism.
 */
export interface SummaryRow {
  period:             Period;
  totalBytesSent:     number;
  totalBytesReceived: number;
  peakSpeedUp:        number;
  peakSpeedDown:      number;
  avgSpeedUp:         number;
  avgSpeedDown:       number;
  sampleCount:        number;
  adapterCount:       number;
}

export function getSummary(period: Period, now = Date.now()): SummaryRow {
  const db               = getDb();
  const { fromTs, toTs } = getPeriodBounds(period, now);

  const row = db.prepare(`
    SELECT
      SUM(bytes_sent)                  AS totalBytesSent,
      SUM(bytes_received)              AS totalBytesReceived,
      MAX(speed_up)                    AS peakSpeedUp,
      MAX(speed_down)                  AS peakSpeedDown,
      CAST(AVG(speed_up)   AS INTEGER) AS avgSpeedUp,
      CAST(AVG(speed_down) AS INTEGER) AS avgSpeedDown,
      COUNT(*)                         AS sampleCount,
      COUNT(DISTINCT adapter_name)     AS adapterCount
    FROM network_metrics
    WHERE timestamp >= ? AND timestamp <= ?
  `).get(fromTs, toTs) as {
    totalBytesSent: number | null; totalBytesReceived: number | null;
    peakSpeedUp: number | null; peakSpeedDown: number | null;
    avgSpeedUp: number | null; avgSpeedDown: number | null;
    sampleCount: number; adapterCount: number;
  };

  return {
    period,
    totalBytesSent:     row.totalBytesSent     ?? 0,
    totalBytesReceived: row.totalBytesReceived  ?? 0,
    peakSpeedUp:        row.peakSpeedUp         ?? 0,
    peakSpeedDown:      row.peakSpeedDown        ?? 0,
    avgSpeedUp:         row.avgSpeedUp           ?? 0,
    avgSpeedDown:       row.avgSpeedDown         ?? 0,
    sampleCount:        row.sampleCount,
    adapterCount:       row.adapterCount,
  };
}
