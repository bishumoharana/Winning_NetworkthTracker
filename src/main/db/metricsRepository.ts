import { getDb } from './database';
import { NetworkMetric } from '../../shared/types';

// Row shape returned by SQLite queries
interface MetricRow {
  id: number;
  adapter_name: string;
  adapter_mac: string;
  timestamp: number;
  bytes_sent: number;
  bytes_received: number;
  speed_up: number;
  speed_down: number;
}

function rowToMetric(row: MetricRow): NetworkMetric {
  return {
    adapterId:     row.adapter_name,
    adapterName:   row.adapter_name,
    timestamp:     row.timestamp,
    bytesSent:     row.bytes_sent,
    bytesReceived: row.bytes_received,
    speedUp:       row.speed_up,
    speedDown:     row.speed_down,
  };
}

/** Insert a single NetworkMetric row. */
export function insertMetric(metric: NetworkMetric): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO network_metrics
      (adapter_name, adapter_mac, timestamp, bytes_sent, bytes_received, speed_up, speed_down)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    metric.adapterName,
    metric.adapterId,
    metric.timestamp,
    metric.bytesSent,
    metric.bytesReceived,
    metric.speedUp,
    metric.speedDown,
  );
}

/**
 * Insert multiple NetworkMetric rows in a single transaction.
 * Much faster than calling insertMetric() in a loop.
 */
export function insertMetricsBatch(metrics: NetworkMetric[]): void {
  if (metrics.length === 0) return;
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO network_metrics
      (adapter_name, adapter_mac, timestamp, bytes_sent, bytes_received, speed_up, speed_down)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insert = db.transaction((rows: NetworkMetric[]) => {
    for (const m of rows) {
      stmt.run(m.adapterName, m.adapterId, m.timestamp, m.bytesSent, m.bytesReceived, m.speedUp, m.speedDown);
    }
  });
  insert(metrics);
}

export interface MetricsQuery {
  adapterName?: string;
  since?:       number; // epoch ms
  until?:       number; // epoch ms
  limit?:       number; // default 1000
}

/** Query raw metrics with optional filters. */
export function queryMetrics(query: MetricsQuery = {}): NetworkMetric[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (query.adapterName) {
    conditions.push('adapter_name = ?');
    params.push(query.adapterName);
  }
  if (query.since !== undefined) {
    conditions.push('timestamp >= ?');
    params.push(query.since);
  }
  if (query.until !== undefined) {
    conditions.push('timestamp <= ?');
    params.push(query.until);
  }

  const where  = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitN = query.limit ?? 1000;

  const rows = db.prepare(
    `SELECT * FROM network_metrics ${where} ORDER BY timestamp DESC LIMIT ?`
  ).all(...params, limitN) as MetricRow[];

  return rows.map(rowToMetric);
}

/** Delete raw metric rows older than the given epoch ms timestamp. */
export function deleteOldMetrics(olderThanMs: number): number {
  const db = getDb();
  const result = db.prepare(
    `DELETE FROM network_metrics WHERE timestamp < ?`
  ).run(olderThanMs);
  return result.changes;
}

export interface MetricsSummary {
  adapterName:   string;
  totalSent:     number;
  totalReceived: number;
  peakSpeedUp:   number;
  peakSpeedDown: number;
  rowCount:      number;
}

/** Returns aggregate totals and peak speeds for a given adapter + time range. */
export function getMetricsSummary(
  adapterName: string,
  since: number,
  until: number,
): MetricsSummary {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      adapter_name    AS adapterName,
      SUM(bytes_sent)      AS totalSent,
      SUM(bytes_received)  AS totalReceived,
      MAX(speed_up)        AS peakSpeedUp,
      MAX(speed_down)      AS peakSpeedDown,
      COUNT(*)             AS rowCount
    FROM network_metrics
    WHERE adapter_name = ? AND timestamp >= ? AND timestamp <= ?
  `).get(adapterName, since, until) as MetricsSummary | undefined;

  return row ?? {
    adapterName,
    totalSent: 0, totalReceived: 0,
    peakSpeedUp: 0, peakSpeedDown: 0,
    rowCount: 0,
  };
}
