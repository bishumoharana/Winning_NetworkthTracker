import { NetworkMonitor, NetworkChangeEvent, NetworkSnapshot } from '../network/networkMonitor';
import { NetworkAdapter } from '../../shared/types';

// Mock Electron BrowserWindow
jest.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: jest.fn().mockReturnValue([]),
  },
}));

// Mock adapterDetector so we control what "os" returns
jest.mock('../network/adapterDetector');
import { getNetworkAdapters } from '../network/adapterDetector';
const mockGetAdapters = getNetworkAdapters as jest.MockedFunction<typeof getNetworkAdapters>;

// ---- Fixtures ---------------------------------------------------------------
const makeAdapter = (overrides: Partial<NetworkAdapter>): NetworkAdapter => ({
  name: 'Wi-Fi',
  mac: 'aa:bb:cc:dd:ee:01',
  type: 'wifi',
  status: 'active',
  ipv4: '192.168.1.5',
  ...overrides,
});

const wifiActive = makeAdapter({ name: 'Wi-Fi', type: 'wifi', status: 'active' });
const wifiInactive = makeAdapter({ name: 'Wi-Fi', type: 'wifi', status: 'inactive' });
const ethActive = makeAdapter({ name: 'Ethernet', type: 'ethernet', status: 'active', mac: 'aa:bb:cc:dd:ee:02' });
const ethInactive = makeAdapter({ name: 'Ethernet', type: 'ethernet', status: 'inactive', mac: 'aa:bb:cc:dd:ee:02' });
const vpnAdapter = makeAdapter({ name: 'VPN', type: 'unknown', status: 'active', mac: 'aa:bb:cc:dd:ee:03' });

// ---- Helpers ----------------------------------------------------------------
function toSnapshot(adapters: NetworkAdapter[]): NetworkSnapshot {
  return new Map(adapters.map((a) => [a.name, a]));
}

// =============================================================================
// computeDiff
// =============================================================================
describe('NetworkMonitor.computeDiff', () => {
  let monitor: NetworkMonitor;

  beforeEach(() => {
    mockGetAdapters.mockReturnValue([wifiActive]);
    monitor = new NetworkMonitor(1000);
  });

  it('emits adapter-added when a new adapter appears', () => {
    const prev = toSnapshot([wifiActive]);
    const curr = toSnapshot([wifiActive, ethActive]);
    const events = monitor.computeDiff(prev, curr);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('adapter-added');
    expect(events[0].adapter.name).toBe('Ethernet');
  });

  it('emits adapter-removed when adapter disappears', () => {
    const prev = toSnapshot([wifiActive, ethActive]);
    const curr = toSnapshot([wifiActive]);
    const events = monitor.computeDiff(prev, curr);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('adapter-removed');
    expect(events[0].adapter.name).toBe('Ethernet');
  });

  it('emits status-changed when adapter goes from active to inactive', () => {
    const prev = toSnapshot([wifiActive]);
    const curr = toSnapshot([wifiInactive]);
    const events = monitor.computeDiff(prev, curr);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('status-changed');
    expect(events[0].adapter.status).toBe('inactive');
    expect(events[0].previousStatus).toBe('active');
  });

  it('emits status-changed when adapter comes back online', () => {
    const prev = toSnapshot([wifiInactive]);
    const curr = toSnapshot([wifiActive]);
    const events = monitor.computeDiff(prev, curr);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('status-changed');
    expect(events[0].adapter.status).toBe('active');
    expect(events[0].previousStatus).toBe('inactive');
  });

  it('returns empty array when nothing changed', () => {
    const snap = toSnapshot([wifiActive, ethActive]);
    const events = monitor.computeDiff(snap, snap);
    expect(events).toHaveLength(0);
  });

  it('emits multiple events when several adapters change at once', () => {
    const prev = toSnapshot([wifiActive, ethActive]);
    const curr = toSnapshot([wifiInactive, ethActive, vpnAdapter]);
    const events = monitor.computeDiff(prev, curr);
    const types = events.map((e) => e.type);
    expect(types).toContain('status-changed');
    expect(types).toContain('adapter-added');
    expect(events).toHaveLength(2);
  });

  it('handles completely empty prev snapshot (all adapters new)', () => {
    const prev: NetworkSnapshot = new Map();
    const curr = toSnapshot([wifiActive, ethActive]);
    const events = monitor.computeDiff(prev, curr);
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.type === 'adapter-added')).toBe(true);
  });

  it('handles completely empty curr snapshot (all adapters removed)', () => {
    const prev = toSnapshot([wifiActive, ethActive]);
    const curr: NetworkSnapshot = new Map();
    const events = monitor.computeDiff(prev, curr);
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.type === 'adapter-removed')).toBe(true);
  });

  it('does not emit event when same status and same adapter', () => {
    const prev = toSnapshot([wifiActive]);
    const curr = toSnapshot([{ ...wifiActive }]); // same data, new object
    const events = monitor.computeDiff(prev, curr);
    expect(events).toHaveLength(0);
  });
});

// =============================================================================
// start / stop / isRunning
// =============================================================================
describe('NetworkMonitor start/stop', () => {
  let monitor: NetworkMonitor;

  beforeEach(() => {
    jest.useFakeTimers();
    mockGetAdapters.mockReturnValue([wifiActive]);
    monitor = new NetworkMonitor(1000);
  });

  afterEach(() => {
    monitor.stop();
    jest.useRealTimers();
  });

  it('isRunning is false before start', () => {
    expect(monitor.isRunning).toBe(false);
  });

  it('isRunning is true after start', () => {
    monitor.start();
    expect(monitor.isRunning).toBe(true);
  });

  it('isRunning is false after stop', () => {
    monitor.start();
    monitor.stop();
    expect(monitor.isRunning).toBe(false);
  });

  it('calling start twice does not create duplicate intervals', () => {
    monitor.start();
    monitor.start(); // second call should be no-op
    expect(monitor.isRunning).toBe(true);
    // poll should only run once per interval tick
    mockGetAdapters.mockReturnValue([wifiActive]);
    jest.advanceTimersByTime(1000);
    // No duplicate events expected
    expect(mockGetAdapters).toHaveBeenCalledTimes(2); // 1 on start + 1 poll
  });

  it('poll is called when timer fires', () => {
    const pollSpy = jest.spyOn(monitor, 'poll');
    monitor.start();
    jest.advanceTimersByTime(3000);
    expect(pollSpy).toHaveBeenCalledTimes(3);
  });
});

// =============================================================================
// poll + primary-changed
// =============================================================================
describe('NetworkMonitor.poll - primary-changed', () => {
  let monitor: NetworkMonitor;

  beforeEach(() => {
    jest.useFakeTimers();
    mockGetAdapters.mockReturnValue([wifiActive]);
    monitor = new NetworkMonitor(1000);
    monitor.start();
  });

  afterEach(() => {
    monitor.stop();
    jest.useRealTimers();
  });

  it('emits primary-changed event when primary adapter switches', () => {
    // Simulate: WiFi was primary, now Ethernet comes online
    mockGetAdapters.mockReturnValue([wifiActive, ethActive]);
    const events = monitor.poll();
    const primaryChanged = events.find((e) => e.type === 'primary-changed');
    expect(primaryChanged).toBeDefined();
    expect(primaryChanged?.adapter.type).toBe('ethernet');
  });

  it('does not emit primary-changed when primary stays same', () => {
    mockGetAdapters.mockReturnValue([wifiActive]); // same as initial
    const events = monitor.poll();
    const primaryChanged = events.find((e) => e.type === 'primary-changed');
    expect(primaryChanged).toBeUndefined();
  });
});

// =============================================================================
// getCurrentAdapters / setSnapshot
// =============================================================================
describe('NetworkMonitor state accessors', () => {
  it('getCurrentAdapters returns current snapshot contents', () => {
    mockGetAdapters.mockReturnValue([wifiActive, ethActive]);
    const monitor = new NetworkMonitor();
    monitor.start();
    const adapters = monitor.getCurrentAdapters();
    expect(adapters.map((a) => a.name)).toEqual(
      expect.arrayContaining(['Wi-Fi', 'Ethernet'])
    );
    monitor.stop();
  });

  it('setSnapshot overrides the current state', () => {
    mockGetAdapters.mockReturnValue([wifiActive]);
    const monitor = new NetworkMonitor();
    monitor.start();
    monitor.setSnapshot([ethActive]);
    const adapters = monitor.getCurrentAdapters();
    expect(adapters).toHaveLength(1);
    expect(adapters[0].name).toBe('Ethernet');
    monitor.stop();
  });
});
