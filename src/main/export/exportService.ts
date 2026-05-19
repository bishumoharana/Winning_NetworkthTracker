/**
 * exportService — Issue #21
 *
 * Queries stored metrics and serialises them to CSV or JSON,
 * writing the output file to the user's Downloads folder.
 *
 * Schema note: network_metrics uses adapter_name + adapter_mac (not adapter_id).
 * The export layer surfaces adapter_mac as adapter_id for external consumers.
 */
import * as fs   from 'fs';
import * as os   from 'os';
import * as path from 'path';
import { app } from 'electron';
import { getDb } from '../db/database';

export type ExportFormat = 'csv' | 'json';

export interface ExportOptions {
  format:     ExportFormat;
  adapterId?: string;   // maps to adapter_mac in the DB; undefined = all adapters
  fromTs?:    number;   // epoch ms, inclusive
  toTs?:      number;   // epoch ms, inclusive
}

export interface ExportResult {
  filePath: string;
  rowCount: number;
}

/** Row shape returned by queryMetrics — mirrors the network_metrics schema. */
export interface MetricRow {
  id:             number;
  adapter_id:     string;  // populated from adapter_mac column
  adapter_name:   string;
  timestamp:      number;
  bytes_sent:     number;
  bytes_received: number;
  speed_up:       number;
  speed_down:     number;
}

/** Query metrics from SQLite with optional adapter + date filters. */
export function queryMetrics(opts: ExportOptions): MetricRow[] {
  const db = getDb();
  const conditions: string[] = [];
  const params:     unknown[] = [];

  // adapter_mac is the stable machine identifier; adapter_name is the display name
  if (opts.adapterId) {
    conditions.push('(adapter_mac = ? OR adapter_name = ?)');
    params.push(opts.adapterId, opts.adapterId);
  }
  if (opts.fromTs !== undefined) {
    conditions.push('timestamp >= ?');
    params.push(opts.fromTs);
  }
  if (opts.toTs !== undefined) {
    conditions.push('timestamp <= ?');
    params.push(opts.toTs);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql   = `SELECT id,
                        adapter_mac  AS adapter_id,
                        adapter_name,
                        timestamp,
                        bytes_sent,
                        bytes_received,
                        speed_up,
                        speed_down
                 FROM network_metrics ${where}
                 ORDER BY timestamp ASC`;

  return db.prepare(sql).all(...params) as MetricRow[];
}

/** Serialise rows to CSV string. */
export function formatCsv(rows: MetricRow[]): string {
  const header = 'id,adapter_id,adapter_name,timestamp,bytes_sent,bytes_received,speed_up_bps,speed_down_bps';
  const lines  = rows.map(r =>
    [r.id, r.adapter_id, `"${r.adapter_name}"`, r.timestamp,
     r.bytes_sent, r.bytes_received, r.speed_up, r.speed_down].join(',')
  );
  return [header, ...lines].join('\n');
}

/** Serialise rows to pretty-printed JSON string. */
export function formatJson(rows: MetricRow[]): string {
  return JSON.stringify(rows.map(r => ({
    id:            r.id,
    adapterId:     r.adapter_id,
    adapterName:   r.adapter_name,
    timestamp:     r.timestamp,
    bytesSent:     r.bytes_sent,
    bytesReceived: r.bytes_received,
    speedUpBps:    r.speed_up,
    speedDownBps:  r.speed_down,
  })), null, 2);
}

/** Build a timestamped filename e.g. network-metrics-2026-05-18T17-39.csv */
function buildFilename(format: ExportFormat): string {
  const ts = new Date().toISOString().replace(/:/g, '-').slice(0, 16);
  return `network-metrics-${ts}.${format}`;
}

/**
 * Main entry point: query, format, and write to Downloads.
 * Returns { filePath, rowCount }.
 */
export function exportMetrics(opts: ExportOptions): ExportResult {
  const rows     = queryMetrics(opts);
  const content  = opts.format === 'csv' ? formatCsv(rows) : formatJson(rows);
  const filename = buildFilename(opts.format);

  // In tests app.getPath may not exist; fall back to os.tmpdir()
  let downloadsDir: string;
  try   { downloadsDir = app.getPath('downloads'); }
  catch { downloadsDir = os.tmpdir(); }

  const filePath = path.join(downloadsDir, filename);
  fs.writeFileSync(filePath, content, 'utf8');

  return { filePath, rowCount: rows.length };
}

/** Return distinct adapter ids + names for the Export UI dropdown. */
export function getExportAdapters(): { adapterId: string; adapterName: string }[] {
  const db   = getDb();
  const rows = db.prepare(
    `SELECT DISTINCT adapter_mac AS adapter_id, adapter_name
     FROM network_metrics
     ORDER BY adapter_name`
  ).all() as { adapter_id: string; adapter_name: string }[];
  return rows.map(r => ({ adapterId: r.adapter_id, adapterName: r.adapter_name }));
}
