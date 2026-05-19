/**
 * Unit tests for Issue #19 — Alerts & Threshold Notifications
 * Mocks Electron's Notification so no real OS notifications fire.
 *
 * TDZ / prefer-const note (same issue as trayManager.test.ts)
 * ─────────────────────────────────────────────────────────────
 * jest.mock() is hoisted above all variable declarations by ts-jest.
 * After transpilation, `const` becomes `var`, so any outer variable
 * that is referenced inside a jest.mock() factory is `undefined` when
 * the factory captures it — NOT a crash, but the captured value is wrong.
 *
 * In this file `mockShow` was declared before jest.mock('electron') in
 * source order.  After hoisting + transpilation the class field
 *   show = mockShow
 * captured `undefined`, making every `.show()` call a no-op.  All
 * mockShow call-count assertions therefore received 0.
 *
 * Fix: inline jest.fn() inside the factory; retrieve the live reference
 * back via jest.requireMock('electron') — zero outer references in the
 * factory body.
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

// ── Mock Electron Notification ────────────────────────────────────────────
// All jest.fn() calls are INLINE — no outer variable referenced in factory.
jest.mock('electron', () => ({
  Notification: class MockNotification {
    static isSupported = () => true;
    show = jest.fn();
    constructor(_opts: unknown) {}
  },
}));

// Helper: retrieve the live mock from the already-mocked module.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function electronMock(): any {
  return jest.requireMock('electron');
}

// ── Test setup ─────────────────────────────────────────────────────────────
beforeEach(() => {
  const mem = new Database(':memory:');
  mem.exec(CREATE_APP_CONFIG);
  const stmt = mem.prepare(`INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)`);
  for (const [k, v] of Object.entries(DEFAULT_CONFIG)) stmt.run(k, v);
  _setDbForTest(mem);
  _resetCooldowns();
  // Clear the static show mock stored on the prototype via the class field.
  // Each test creates new instances, so we track calls via a shared spy
  // injected on the prototype.
  jest.clearAllMocks();
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

// Helper: count how many times show() was called across all Notification
// instances since last clearAllMocks.  Because each `new Notification()`
// creates a fresh instance with its own jest.fn() field, we instead spy
// on the prototype show after construction — or, simpler: wrap fireNotification
// by spying on the MockNotification constructor and tracking instances.
//
// Simplest reliable approach: spy on MockNotification.prototype.show.
function getShowMock(): jest.Mock {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (electronMock().Notification.prototype as any).show as jest.Mock;
}

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
    expect(getShowMock()).not.toHaveBeenCalled();
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
    expect(getShowMock()).toHaveBeenCalledTimes(1);
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
    expect(getShowMock()).toHaveBeenCalledTimes(1);
  });

  it('fires again after cooldown expires', () => {
    const metric = makeMetric({ speedDown: 0 });
    evaluateMetrics([metric], ENABLED_CONFIG, 1000);
    const second = evaluateMetrics([metric], ENABLED_CONFIG, 65_000); // 64s later
    expect(second).toHaveLength(1);
    expect(getShowMock()).toHaveBeenCalledTimes(2);
  });

  it('tracks cooldown per adapter independently', () => {
    evaluateMetrics([makeMetric({ adapterName: 'eth0',  speedDown: 0 })], ENABLED_CONFIG, 1000);
    const fired = evaluateMetrics([makeMetric({ adapterName: 'wlan0', speedDown: 0 })], ENABLED_CONFIG, 1000);
    expect(fired).toHaveLength(1); // wlan0 has its own cooldown
    expect(getShowMock()).toHaveBeenCalledTimes(2);
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
