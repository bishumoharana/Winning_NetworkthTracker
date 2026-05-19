/**
 * Unit tests for Issue #21 — exportService
 *
 * Schema alignment fix: network_metrics has no `adapter_id` column.
 * The stable machine identifier is stored in `adapter_mac`.
 * exportService.ts aliases adapter_mac AS adapter_id in SELECT.
 * The seed helper here uses adapter_mac so the test DB matches production.
 */
import Database from 'better-sqlite3';
import * as os   from 'os';
import * as fs   from 'fs';
import { _setDbForTest } from '../db/database';
import { CREATE_NETWORK_METRICS } from '../db/schema';

jest.mock('electron', () => ({
  app: {
    getPath: () => (jest.requireActual('os') as typeof import('os')).tmpdir(),
  },
}));

import {
  queryMetrics,
  formatCsv,
  formatJson,
  exportMetrics,
  getExportAdapters,
  MetricRow,
} from '../export/exportService';

const NOW = 1_747_500_000_000;

/**
 * Seed helper — uses the real schema columns:
 *   adapter_name, adapter_mac (NOT adapter_id)
 * exportService aliases adapter_mac AS adapter_id in queries.
 */
function seedDb(db: InstanceType<typeof Database>) {
  db.exec(CREATE_NETWORK_METRICS);
  const ins = db.prepare(
    `INSERT INTO network_metrics
     (adapter_name, adapter_mac, timestamp, bytes_sent, bytes_received, speed_up, speed_down)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  // adapter_mac used as the stable adapter id
  ins.run('Ethernet', 'eth0',  NOW - 5000, 1000, 2000, 100, 200);
  ins.run('Ethernet', 'eth0',  NOW,        3000, 4000, 300, 400);
  ins.run('Wi-Fi',    'wlan0', NOW - 2000,  500,  600,  50,  60);
}

beforeEach(() => {
  const mem = new Database(':memory:');
  seedDb(mem);
  _setDbForTest(mem);
});

// ── queryMetrics ─────────────────────────────────────────────────────────────
describe('queryMetrics', () => {
  it('returns all rows when no filter', () => {
    expect(queryMetrics({ format: 'csv' })).toHaveLength(3);
  });

  it('filters by adapterId (matches adapter_mac)', () => {
    const rows = queryMetrics({ format: 'csv', adapterId: 'eth0' });
    expect(rows).toHaveLength(2);
    rows.forEach(r => expect(r.adapter_id).toBe('eth0'));
  });

  it('filters by fromTs', () => {
    const rows = queryMetrics({ format: 'csv', fromTs: NOW - 3000 });
    expect(rows).toHaveLength(2);
  });

  it('filters by toTs', () => {
    const rows = queryMetrics({ format: 'csv', toTs: NOW - 3000 });
    expect(rows).toHaveLength(1);
  });

  it('combines adapterId + date range', () => {
    const rows = queryMetrics({ format: 'csv', adapterId: 'eth0', fromTs: NOW, toTs: NOW });
    expect(rows).toHaveLength(1);
    expect(rows[0].speed_up).toBe(300);
  });

  it('returns empty array when nothing matches', () => {
    expect(queryMetrics({ format: 'csv', adapterId: 'nonexistent' })).toHaveLength(0);
  });
});

// ── formatCsv ───────────────────────────────────────────────────────────────────
describe('formatCsv', () => {
  it('includes header row', () => {
    const csv = formatCsv([]);
    expect(csv.split('\n')[0]).toContain('adapter_id');
    expect(csv.split('\n')[0]).toContain('speed_up_bps');
  });

  it('produces correct number of lines (header + rows)', () => {
    const rows = queryMetrics({ format: 'csv' });
    const csv  = formatCsv(rows);
    expect(csv.split('\n')).toHaveLength(rows.length + 1);
  });

  it('preserves bps values as plain numbers', () => {
    const row: MetricRow = {
      id: 1, adapter_id: 'eth0', adapter_name: 'Ethernet',
      timestamp: NOW, bytes_sent: 0, bytes_received: 0, speed_up: 123456, speed_down: 654321,
    };
    const csv = formatCsv([row]);
    expect(csv).toContain('123456');
    expect(csv).toContain('654321');
  });

  it('quotes adapter_name containing spaces', () => {
    const row: MetricRow = {
      id: 1, adapter_id: 'w0', adapter_name: 'Wi-Fi Adapter',
      timestamp: NOW, bytes_sent: 0, bytes_received: 0, speed_up: 0, speed_down: 0,
    };
    expect(formatCsv([row])).toContain('"Wi-Fi Adapter"');
  });
});

// ── formatJson ───────────────────────────────────────────────────────────────────
describe('formatJson', () => {
  it('produces valid JSON array', () => {
    const rows = queryMetrics({ format: 'json' });
    const arr  = JSON.parse(formatJson(rows));
    expect(Array.isArray(arr)).toBe(true);
    expect(arr).toHaveLength(rows.length);
  });

  it('uses camelCase keys', () => {
    const rows = queryMetrics({ format: 'json' });
    const obj  = JSON.parse(formatJson(rows))[0];
    expect(obj).toHaveProperty('adapterId');
    expect(obj).toHaveProperty('speedUpBps');
    expect(obj).not.toHaveProperty('adapter_id');
  });

  it('empty array produces []', () => {
    expect(JSON.parse(formatJson([]))).toEqual([]);
  });
});

// ── exportMetrics (file write) ────────────────────────────────────────────────
describe('exportMetrics', () => {
  it('writes a CSV file and returns correct rowCount', () => {
    const res = exportMetrics({ format: 'csv' });
    expect(res.rowCount).toBe(3);
    expect(res.filePath).toMatch(/\.csv$/);
    expect(fs.existsSync(res.filePath)).toBe(true);
    fs.unlinkSync(res.filePath);
  });

  it('writes a JSON file and returns correct rowCount', () => {
    const res = exportMetrics({ format: 'json' });
    expect(res.rowCount).toBe(3);
    expect(res.filePath).toMatch(/\.json$/);
    const content = JSON.parse(fs.readFileSync(res.filePath, 'utf8'));
    expect(content).toHaveLength(3);
    fs.unlinkSync(res.filePath);
  });

  it('file is placed in os.tmpdir() (mocked Downloads)', () => {
    const res = exportMetrics({ format: 'csv' });
    expect(res.filePath.startsWith(os.tmpdir())).toBe(true);
    fs.unlinkSync(res.filePath);
  });

  it('rowCount = 0 for no-match filter', () => {
    const res = exportMetrics({ format: 'csv', adapterId: 'ghost' });
    expect(res.rowCount).toBe(0);
    fs.unlinkSync(res.filePath);
  });
});

// ── getExportAdapters ─────────────────────────────────────────────────────────────
describe('getExportAdapters', () => {
  it('returns distinct adapters', () => {
    const adapters = getExportAdapters();
    expect(adapters).toHaveLength(2);
    const ids = adapters.map(a => a.adapterId);
    expect(ids).toContain('eth0');
    expect(ids).toContain('wlan0');
  });
});
