/**
 * Unit tests for Task 1.3 — Real-time Network State Monitoring
 * Tests the NetworkMonitor class: lifecycle, diff logic, event types.
 */
import { NetworkMonitor, NetworkChangeEvent } from '../network/networkMonitor';
import { NetworkAdapter } from '../../shared/types';

// Helper: build a minimal NetworkAdapter
const makeAdapter = (
  name: string,
  type: NetworkAdapter['type'] = 'ethernet',
  status: NetworkAdapter['status'] = 'active'
): NetworkAdapter => ({ name, mac: 'aa:bb:cc:00:00:01', type, status });

// ── Lifecycle ────────────────────────────────────────────────────────────────
describe('NetworkMonitor lifecycle', () => {
  it('starts with isRunning = false', () => {
    const m = new NetworkMonitor(500);
    expect(m.isRunning).toBe(false);
  });

  it('isRunning becomes true after start()', () => {
    const m = new NetworkMonitor(500);
    m.start();
    expect(m.isRunning).toBe(true);
    m.stop();
  });

  it('isRunning becomes false after stop()', () => {
    const m = new NetworkMonitor(500);
    m.start();
    m.stop();
    expect(m.isRunning).toBe(false);
  });

  it('calling start() twice does not create two intervals', () => {
    const m = new NetworkMonitor(500);
    m.start();
    m.start(); // should be a no-op
    expect(m.isRunning).toBe(true);
    m.stop();
  });

  it('calling stop() when not started does not throw', () => {
    const m = new NetworkMonitor(500);
    expect(() => m.stop()).not.toThrow();
  });
});

// ── Snapshot & getCurrentAdapters ────────────────────────────────────────────
describe('NetworkMonitor snapshot management', () => {
  it('getCurrentAdapters() returns empty array before start', () => {
    const m = new NetworkMonitor(500);
    expect(m.getCurrentAdapters()).toEqual([]);
  });

  it('setSnapshot() / getCurrentAdapters() round-trip', () => {
    const m = new NetworkMonitor(500);
    const adapters = [makeAdapter('eth0'), makeAdapter('wlan0', 'wifi', 'standby')];
    m.setSnapshot(adapters);
    const result = m.getCurrentAdapters();
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.name)).toContain('eth0');
    expect(result.map((a) => a.name)).toContain('wlan0');
  });
});

// ── computeDiff ──────────────────────────────────────────────────────────────
describe('NetworkMonitor.computeDiff()', () => {
  let monitor: NetworkMonitor;

  beforeEach(() => {
    monitor = new NetworkMonitor(500);
  });

  it('returns empty array when snapshots are identical', () => {
    const adapter = makeAdapter('eth0');
    const snap = new Map([['eth0', adapter]]);
    expect(monitor.computeDiff(snap, snap)).toHaveLength(0);
  });

  it('detects adapter-added when a new adapter appears', () => {
    const prev = new Map<string, NetworkAdapter>();
    const curr = new Map([['eth0', makeAdapter('eth0')]]);
    const events = monitor.computeDiff(prev, curr);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('adapter-added');
    expect(events[0].adapter.name).toBe('eth0');
  });

  it('detects adapter-removed when an adapter disappears', () => {
    const prev = new Map([['eth0', makeAdapter('eth0')]]);
    const curr = new Map<string, NetworkAdapter>();
    const events = monitor.computeDiff(prev, curr);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('adapter-removed');
    expect(events[0].adapter.name).toBe('eth0');
  });

  it('detects status-changed when adapter status changes', () => {
    const prev = new Map([['eth0', makeAdapter('eth0', 'ethernet', 'active')]]);
    const curr = new Map([['eth0', makeAdapter('eth0', 'ethernet', 'inactive')]]);
    const events = monitor.computeDiff(prev, curr);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('status-changed');
    expect(events[0].previousStatus).toBe('active');
    expect(events[0].adapter.status).toBe('inactive');
  });

  it('does NOT emit event when status is unchanged', () => {
    const adapter = makeAdapter('eth0', 'ethernet', 'active');
    const prev = new Map([['eth0', adapter]]);
    const curr = new Map([['eth0', { ...adapter }]]);
    const events = monitor.computeDiff(prev, curr);
    expect(events).toHaveLength(0);
  });

  it('detects multiple changes simultaneously', () => {
    const prev = new Map([
      ['eth0', makeAdapter('eth0', 'ethernet', 'active')],
      ['wlan0', makeAdapter('wlan0', 'wifi', 'standby')],
    ]);
    const curr = new Map([
      ['eth0', makeAdapter('eth0', 'ethernet', 'inactive')],
      ['wlan1', makeAdapter('wlan1', 'wifi', 'active')],
    ]);
    const events = monitor.computeDiff(prev, curr);
    const types = events.map((e) => e.type);
    expect(types).toContain('status-changed');  // eth0 active -> inactive
    expect(types).toContain('adapter-added');   // wlan1 new
    expect(types).toContain('adapter-removed'); // wlan0 gone
  });

  it('includes previousStatus only in status-changed events', () => {
    const prev = new Map([['eth0', makeAdapter('eth0', 'ethernet', 'active')]]);
    const curr = new Map([['eth0', makeAdapter('eth0', 'ethernet', 'standby')]]);
    const events = monitor.computeDiff(prev, curr);
    expect(events[0].previousStatus).toBe('active');

    // adapter-added should not have previousStatus
    const added = monitor.computeDiff(
      new Map(),
      new Map([['eth0', makeAdapter('eth0')]])
    );
    expect(added[0].previousStatus).toBeUndefined();
  });
});

// ── Event types ───────────────────────────────────────────────────────────────
describe('NetworkChangeEvent types', () => {
  it('all four event types are valid string literals', () => {
    const types: NetworkChangeEvent['type'][] = [
      'adapter-added',
      'adapter-removed',
      'status-changed',
      'primary-changed',
    ];
    expect(types).toHaveLength(4);
  });
});
