/**
 * Unit tests for Task 2.1 — Network Traffic Capture
 * Tests trafficCapture.ts logic with mocked systeminformation.
 */
import {
  captureTrafficMetrics,
  resetCounters,
  formatSpeed,
  getPreviousCounters,
} from '../network/trafficCapture';

// Mock systeminformation to avoid real network calls in tests
jest.mock('systeminformation', () => ({
  __esModule: true,
  default: {
    networkStats: jest.fn(),
  },
}));

import si from 'systeminformation';
const mockNetworkStats = si.networkStats as jest.Mock;

// Helper: build a fake si.networkStats() entry
function makeStat(iface: string, tx: number, rx: number) {
  return { iface, tx_bytes: tx, rx_bytes: rx };
}

beforeEach(() => {
  resetCounters();
  jest.clearAllMocks();
});

// -------------------------------------------------------------------------
// First-read baseline
// -------------------------------------------------------------------------
describe('captureTrafficMetrics — first read (baseline)', () => {
  it('returns 0 speed on the first read for a new adapter', async () => {
    mockNetworkStats.mockResolvedValue([makeStat('eth0', 1000, 2000)]);

    const metrics = await captureTrafficMetrics();
    expect(metrics).toHaveLength(1);
    expect(metrics[0].adapterId).toBe('eth0');
    expect(metrics[0].speedUp).toBe(0);
    expect(metrics[0].speedDown).toBe(0);
    expect(metrics[0].bytesSent).toBe(0);
    expect(metrics[0].bytesReceived).toBe(0);
  });

  it('stores the first read in previousCounters', async () => {
    mockNetworkStats.mockResolvedValue([makeStat('wlan0', 500, 800)]);
    await captureTrafficMetrics();
    expect(getPreviousCounters().has('wlan0')).toBe(true);
    expect(getPreviousCounters().get('wlan0')!.bytesSent).toBe(500);
  });
});

// -------------------------------------------------------------------------
// Delta calculation
// -------------------------------------------------------------------------
describe('captureTrafficMetrics — delta calculation', () => {
  it('calculates correct byte deltas between two readings', async () => {
    // First read (baseline)
    mockNetworkStats.mockResolvedValueOnce([makeStat('eth0', 1000, 2000)]);
    await captureTrafficMetrics();

    // Second read after 1s (+500 sent, +1000 received)
    mockNetworkStats.mockResolvedValueOnce([makeStat('eth0', 1500, 3000)]);
    const metrics = await captureTrafficMetrics();

    expect(metrics[0].bytesSent).toBe(500);
    expect(metrics[0].bytesReceived).toBe(1000);
  });

  it('calculates speed proportional to elapsed time', async () => {
    mockNetworkStats.mockResolvedValueOnce([makeStat('eth0', 0, 0)]);
    await captureTrafficMetrics();

    mockNetworkStats.mockResolvedValueOnce([makeStat('eth0', 2000, 4000)]);
    const metrics = await captureTrafficMetrics();

    // Speed should be bytes / elapsed seconds (~1s)
    // We can't know exact elapsed time in test, but deltas should be correct
    expect(metrics[0].bytesSent).toBe(2000);
    expect(metrics[0].bytesReceived).toBe(4000);
    expect(metrics[0].speedUp).toBeGreaterThan(0);
    expect(metrics[0].speedDown).toBeGreaterThan(0);
  });

  it('handles zero traffic between reads (no activity)', async () => {
    mockNetworkStats.mockResolvedValueOnce([makeStat('eth0', 1000, 2000)]);
    await captureTrafficMetrics();

    mockNetworkStats.mockResolvedValueOnce([makeStat('eth0', 1000, 2000)]);
    const metrics = await captureTrafficMetrics();

    expect(metrics[0].bytesSent).toBe(0);
    expect(metrics[0].bytesReceived).toBe(0);
    expect(metrics[0].speedUp).toBe(0);
    expect(metrics[0].speedDown).toBe(0);
  });

  it('guards against counter reset (negative delta → 0)', async () => {
    mockNetworkStats.mockResolvedValueOnce([makeStat('eth0', 5000, 8000)]);
    await captureTrafficMetrics();

    // Simulate counter reset: new values are lower than previous
    mockNetworkStats.mockResolvedValueOnce([makeStat('eth0', 100, 200)]);
    const metrics = await captureTrafficMetrics();

    expect(metrics[0].bytesSent).toBe(0);
    expect(metrics[0].bytesReceived).toBe(0);
  });

  it('handles multiple adapters in one read', async () => {
    mockNetworkStats.mockResolvedValueOnce([
      makeStat('eth0', 0, 0),
      makeStat('wlan0', 0, 0),
    ]);
    await captureTrafficMetrics();

    mockNetworkStats.mockResolvedValueOnce([
      makeStat('eth0', 1000, 2000),
      makeStat('wlan0', 500, 800),
    ]);
    const metrics = await captureTrafficMetrics();

    expect(metrics).toHaveLength(2);
    const eth = metrics.find((m) => m.adapterId === 'eth0')!;
    const wlan = metrics.find((m) => m.adapterId === 'wlan0')!;
    expect(eth.bytesSent).toBe(1000);
    expect(wlan.bytesSent).toBe(500);
  });
});

// -------------------------------------------------------------------------
// resetCounters
// -------------------------------------------------------------------------
describe('resetCounters', () => {
  it('clears all stored counters', async () => {
    mockNetworkStats.mockResolvedValue([makeStat('eth0', 1000, 2000)]);
    await captureTrafficMetrics();
    expect(getPreviousCounters().size).toBe(1);

    resetCounters();
    expect(getPreviousCounters().size).toBe(0);
  });

  it('returns 0 speed on first read after reset', async () => {
    mockNetworkStats.mockResolvedValueOnce([makeStat('eth0', 5000, 9000)]);
    await captureTrafficMetrics(); // baseline
    mockNetworkStats.mockResolvedValueOnce([makeStat('eth0', 6000, 10000)]);
    await captureTrafficMetrics(); // second read — speeds > 0

    resetCounters();

    mockNetworkStats.mockResolvedValueOnce([makeStat('eth0', 6000, 10000)]);
    const metrics = await captureTrafficMetrics(); // first read after reset
    expect(metrics[0].speedUp).toBe(0);
  });
});

// -------------------------------------------------------------------------
// formatSpeed
// -------------------------------------------------------------------------
describe('formatSpeed', () => {
  it('formats bytes per second under 1KB', () => {
    expect(formatSpeed(0)).toBe('0 B/s');
    expect(formatSpeed(512)).toBe('512 B/s');
    expect(formatSpeed(999)).toBe('999 B/s');
  });

  it('formats KB/s correctly', () => {
    expect(formatSpeed(1000)).toBe('1.0 KB/s');
    expect(formatSpeed(2500)).toBe('2.5 KB/s');
    expect(formatSpeed(999_999)).toBe('1000.0 KB/s');
  });

  it('formats MB/s correctly', () => {
    expect(formatSpeed(1_000_000)).toBe('1.0 MB/s');
    expect(formatSpeed(5_500_000)).toBe('5.5 MB/s');
  });

  it('formats GB/s correctly', () => {
    expect(formatSpeed(1_000_000_000)).toBe('1.0 GB/s');
    expect(formatSpeed(2_750_000_000)).toBe('2.8 GB/s');
  });
});
