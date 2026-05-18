/**
 * Unit tests for Issue #23 — statsService
 */
import Database from 'better-sqlite3';
import { _setDbForTest } from '../db/database';
import { CREATE_NETWORK_METRICS } from '../db/schema';
import {
  getStats,
  getSummary,
  getPeriodBounds,
} from '../stats/statsService';
import type { Period } from '../stats/statsService';

// Fixed reference timestamp: 2026-05-18T12:00:00.000 local
const REF = new Date(2026, 4, 18, 12, 0, 0, 0).getTime();

function seedDb(db: InstanceType<typeof Database>) {
  db.exec(CREATE_NETWORK_METRICS);
  const ins = db.prepare(
    `INSERT INTO network_metrics
     (adapter_id, adapter_name, timestamp, bytes_sent, bytes_received, speed_up, speed_down)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  // eth0: 3 samples today
  ins.run('eth0', 'Ethernet', REF - 10_000, 100, 200, 1000, 2000);
  ins.run('eth0', 'Ethernet', REF,          200, 400, 3000, 4000);
  ins.run('eth0', 'Ethernet', REF + 10_000, 150, 300, 2000, 3000);
  // wlan0: 2 samples today
  ins.run('wlan0', 'Wi-Fi', REF - 5_000, 50,  80,  500,  800);
  ins.run('wlan0', 'Wi-Fi', REF + 5_000, 70, 100,  700, 1000);
}

beforeEach(() => {
  const mem = new Database(':memory:');
  seedDb(mem);
  _setDbForTest(mem);
});

// ── getPeriodBounds ────────────────────────────────────────────────────────
describe('getPeriodBounds', () => {
  it('day bounds contain the reference time', () => {
    const { fromTs, toTs } = getPeriodBounds('day', REF);
    expect(fromTs).toBeLessThanOrEqual(REF);
    expect(toTs).toBeGreaterThanOrEqual(REF);
    expect(toTs - fromTs).toBeGreaterThanOrEqual(86_399_999); // ~24h
  });

  it('week bounds span 7 days', () => {
    const { fromTs, toTs } = getPeriodBounds('week', REF);
    expect(fromTs).toBeLessThanOrEqual(REF);
    expect(toTs).toBeGreaterThanOrEqual(REF);
    expect(toTs - fromTs).toBeGreaterThanOrEqual(6 * 86_400_000);
  });

  it('month bounds contain the reference time', () => {
    const { fromTs, toTs } = getPeriodBounds('month', REF);
    expect(fromTs).toBeLessThanOrEqual(REF);
    expect(toTs).toBeGreaterThanOrEqual(REF);
  });
});

// ── getStats ─────────────────────────────────────────────────────────────────
describe('getStats', () => {
  it('returns one row per adapter', () => {
    const rows = getStats('day');
    expect(rows).toHaveLength(2);
    const ids = rows.map(r => r.adapterId);
    expect(ids).toContain('eth0');
    expect(ids).toContain('wlan0');
  });

  it('aggregates totalBytesSent correctly for eth0', () => {
    const rows = getStats('day');
    const eth0 = rows.find(r => r.adapterId === 'eth0')!;
    expect(eth0.totalBytesSent).toBe(450);      // 100+200+150
    expect(eth0.totalBytesReceived).toBe(900);  // 200+400+300
  });

  it('calculates peakSpeedUp correctly', () => {
    const eth0 = getStats('day').find(r => r.adapterId === 'eth0')!;
    expect(eth0.peakSpeedUp).toBe(3000);
  });

  it('calculates peakSpeedDown correctly', () => {
    const eth0 = getStats('day').find(r => r.adapterId === 'eth0')!;
    expect(eth0.peakSpeedDown).toBe(4000);
  });

  it('calculates avgSpeedUp (integer) correctly', () => {
    const eth0 = getStats('day').find(r => r.adapterId === 'eth0')!;
    // (1000+3000+2000)/3 = 2000
    expect(eth0.avgSpeedUp).toBe(2000);
  });

  it('reports correct sampleCount', () => {
    const eth0  = getStats('day').find(r => r.adapterId === 'eth0')!;
    const wlan0 = getStats('day').find(r => r.adapterId === 'wlan0')!;
    expect(eth0.sampleCount).toBe(3);
    expect(wlan0.sampleCount).toBe(2);
  });

  it('filters by adapterId', () => {
    const rows = getStats('day', 'eth0');
    expect(rows).toHaveLength(1);
    expect(rows[0].adapterId).toBe('eth0');
  });

  it('returns empty array when no data in period', () => {
    // Filter to an unknown adapter
    const rows = getStats('day', 'nonexistent');
    expect(rows).toHaveLength(0);
  });

  it('attaches the period field to each row', () => {
    const rows = getStats('week') as Array<{ period: Period }>;
    rows.forEach(r => expect(r.period).toBe('week'));
  });
});

// ── getSummary ─────────────────────────────────────────────────────────────────
describe('getSummary', () => {
  it('returns correct total bytes across all adapters', () => {
    const s = getSummary('day');
    // eth0 bytesSent=450 + wlan0 bytesSent=120
    expect(s.totalBytesSent).toBe(570);
    // eth0 bytesReceived=900 + wlan0=180
    expect(s.totalBytesReceived).toBe(1080);
  });

  it('returns total sampleCount across all adapters', () => {
    expect(getSummary('day').sampleCount).toBe(5);
  });

  it('returns correct adapterCount', () => {
    expect(getSummary('day').adapterCount).toBe(2);
  });

  it('returns global peakSpeedDown', () => {
    expect(getSummary('day').peakSpeedDown).toBe(4000);
  });

  it('returns zeros when DB is empty for period', () => {
    // Clear the DB
    const mem = new Database(':memory:');
    mem.exec(CREATE_NETWORK_METRICS);
    _setDbForTest(mem);
    const s = getSummary('day');
    expect(s.totalBytesSent).toBe(0);
    expect(s.sampleCount).toBe(0);
  });
});
