/**
 * Unit tests for Issue #19 — Alerts & Threshold Notifications
 * Mocks Electron's Notification so no real OS notifications fire.
 */
import Database from 'better-sqlite3';
import { _setDbForTest } from '../db/database';
import {
  getAlertConfig,
  saveAlertConfig,
  evaluateMetrics,
  _resetCooldowns,
  AlertConfig,
} from '../alerts/alertsService';
import {
  CREATE_APP_CONFIG,
  DEFAULT_CONFIG,
} from '../db/schema';
import { NetworkMetric } from '../../shared/types';

// ── Mock Electron Notification ───────────────────────────────────────────────
const mockShow = jest.fn();
jest.mock('electron', () => ({
  Notification: class MockNotification {
    static isSupported = () => true;
    show = mockShow;
    constructor(_opts: unknown) {}
  },
}));

// ── Test setup ────────────────────────────────────────────────────────────
beforeEach(() => {
  const mem = new Database(':memory:');
  mem.exec(CREATE_APP_CONFIG);
  const stmt = mem.prepare(`INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)`);
  for (const [k, v] of Object.entries(DEFAULT_CONFIG)) stmt.run(k, v);
  _setDbForTest(mem);
  _resetCooldowns();
  mockShow.mockClear();
});

function makeMetric(overrides: Partial<NetworkMetric> = {}): NetworkMetric {
  return {
    adapterId: 'eth0', adapterName: 'eth0', timestamp: Date.now(),
    bytesSent: 0, bytesReceived: 0, speedUp: 5_000_000, speedDown: 10_000_000,
    ...overrides,
  };
}

const ENABLED_CONFIG: AlertConfig = {
  enabled: true,
  downloadThresholdBps: 1_048_576, // 1 MB/s
  uploadThresholdBps:   524_288,   // 0.5 MB/s
};

// ── Config read/write ──────────────────────────────────────────────────────
describe('getAlertConfig', () => {
  it('returns defaults when config keys are default', () => {
    const cfg = getAlertConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.downloadThresholdBps).toBe(0);
    expect(cfg.uploadThresholdBps).toBe(0);
  });
});

describe('saveAlertConfig + getAlertConfig round-trip', () => {
  it('persists and retrieves alert config', () => {
    saveAlertConfig(ENABLED_CONFIG);
    const cfg = getAlertConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.downloadThresholdBps).toBe(1_048_576);
    expect(cfg.uploadThresholdBps).toBe(524_288);
  });

  it('can save disabled config', () => {
    saveAlertConfig({ enabled: false, downloadThresholdBps: 0, uploadThresholdBps: 0 });
    expect(getAlertConfig().enabled).toBe(false);
  });
});

// ── evaluateMetrics ──────────────────────────────────────────────────────
describe('evaluateMetrics — disabled', () => {
  it('returns empty array when alerts disabled', () => {
    const cfg = { ...ENABLED_CONFIG, enabled: false };
    const fired = evaluateMetrics([makeMetric({ speedDown: 0 })], cfg);
    expect(fired).toHaveLength(0);
    expect(mockShow).not.toHaveBeenCalled();
  });
});

describe('evaluateMetrics — download threshold', () => {
  it('fires when download speed is below threshold', () => {
    const fired = evaluateMetrics(
      [makeMetric({ speedDown: 500_000 })], // 0.5 MB/s < 1 MB/s
      ENABLED_CONFIG,
    );
    expect(fired).toHaveLength(1);
    expect(fired[0].type).toBe('download');
    expect(fired[0].actual).toBe(500_000);
    expect(mockShow).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire when download is at or above threshold', () => {
    const fired = evaluateMetrics(
      [makeMetric({ speedDown: 1_048_576 })], // exactly at threshold
      ENABLED_CONFIG,
    );
    expect(fired).toHaveLength(0);
  });

  it('does NOT fire when downloadThresholdBps is 0 (disabled)', () => {
    const cfg = { ...ENABLED_CONFIG, downloadThresholdBps: 0 };
    expect(evaluateMetrics([makeMetric({ speedDown: 0 })], cfg)).toHaveLength(0);
  });
});

describe('evaluateMetrics — upload threshold', () => {
  it('fires for upload breach when download is fine', () => {
    const fired = evaluateMetrics(
      [makeMetric({ speedUp: 100_000, speedDown: 5_000_000 })], // upload low, download fine
      ENABLED_CONFIG,
    );
    expect(fired).toHaveLength(1);
    expect(fired[0].type).toBe('upload');
  });

  it('prefers download alert over upload when both breach', () => {
    const fired = evaluateMetrics(
      [makeMetric({ speedUp: 0, speedDown: 0 })],
      ENABLED_CONFIG,
    );
    expect(fired).toHaveLength(1);
    expect(fired[0].type).toBe('download'); // download checked first
  });
});

describe('evaluateMetrics — cooldown', () => {
  it('does not fire twice within 60s cooldown window', () => {
    const metric = makeMetric({ speedDown: 0 });
    evaluateMetrics([metric], ENABLED_CONFIG, 1000);
    const second = evaluateMetrics([metric], ENABLED_CONFIG, 30_000); // 29s later
    expect(second).toHaveLength(0);
    expect(mockShow).toHaveBeenCalledTimes(1);
  });

  it('fires again after cooldown expires', () => {
    const metric = makeMetric({ speedDown: 0 });
    evaluateMetrics([metric], ENABLED_CONFIG, 1000);
    const second = evaluateMetrics([metric], ENABLED_CONFIG, 65_000); // 64s later
    expect(second).toHaveLength(1);
    expect(mockShow).toHaveBeenCalledTimes(2);
  });

  it('tracks cooldown per adapter independently', () => {
    evaluateMetrics([makeMetric({ adapterName: 'eth0', speedDown: 0 })], ENABLED_CONFIG, 1000);
    const fired = evaluateMetrics([makeMetric({ adapterName: 'wlan0', speedDown: 0 })], ENABLED_CONFIG, 1000);
    expect(fired).toHaveLength(1); // wlan0 has its own cooldown
    expect(mockShow).toHaveBeenCalledTimes(2);
  });
});

describe('evaluateMetrics — multi-adapter batch', () => {
  it('evaluates all adapters in a single batch', () => {
    const metrics = [
      makeMetric({ adapterName: 'eth0',  speedDown: 0 }),
      makeMetric({ adapterName: 'wlan0', speedDown: 0 }),
      makeMetric({ adapterName: 'lo',    speedDown: 50_000_000 }), // fast, no alert
    ];
    const fired = evaluateMetrics(metrics, ENABLED_CONFIG);
    expect(fired).toHaveLength(2);
    expect(fired.map(f => f.adapterName).sort()).toEqual(['eth0', 'wlan0']);
  });
});
