import si from 'systeminformation';
import { NetworkMetric } from '../../shared/types';

// Snapshot of raw byte counters from a single systeminformation read
export interface RawCounters {
  iface: string;
  bytesSent: number;
  bytesReceived: number;
  timestamp: number;
}

// Stores the most recent raw counters per adapter
let previousCounters: Map<string, RawCounters> = new Map();

/**
 * Reads current byte counters for all adapters via systeminformation.
 * On the first call for an adapter there is no previous snapshot,
 * so speed is reported as 0 (baseline established).
 *
 * Returns one NetworkMetric per adapter present in the stats.
 */
export async function captureTrafficMetrics(): Promise<NetworkMetric[]> {
  const stats = await si.networkStats();
  const now = Date.now();
  const metrics: NetworkMetric[] = [];

  for (const stat of stats) {
    const iface = stat.iface;
    const current: RawCounters = {
      iface,
      bytesSent: stat.tx_bytes ?? 0,
      bytesReceived: stat.rx_bytes ?? 0,
      timestamp: now,
    };

    const previous = previousCounters.get(iface);

    let speedUp = 0;
    let speedDown = 0;
    let bytesSent = 0;
    let bytesReceived = 0;

    if (previous) {
      const dtMs = current.timestamp - previous.timestamp;
      const dtSec = dtMs > 0 ? dtMs / 1000 : 1;

      // Protect against counter resets (reboots / driver reload)
      bytesSent = Math.max(0, current.bytesSent - previous.bytesSent);
      bytesReceived = Math.max(0, current.bytesReceived - previous.bytesReceived);

      speedUp = bytesSent / dtSec;
      speedDown = bytesReceived / dtSec;
    }
    // If no previous: baseline read — report 0 deltas

    previousCounters.set(iface, current);

    metrics.push({
      adapterId: iface,
      adapterName: iface,
      timestamp: now,
      bytesSent,
      bytesReceived,
      speedUp,
      speedDown,
    });
  }

  return metrics;
}

/**
 * Resets all stored counters. Used in tests and on adapter removal.
 */
export function resetCounters(): void {
  previousCounters = new Map();
}

/**
 * Returns current snapshot of raw counters (for testing).
 */
export function getPreviousCounters(): Map<string, RawCounters> {
  return previousCounters;
}

/**
 * Auto-scales bytes/sec to a human-readable string.
 * Examples: 512 → "512 B/s", 2048 → "2.0 KB/s", 1500000 → "1.4 MB/s"
 */
export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec >= 1_000_000_000) {
    return `${(bytesPerSec / 1_000_000_000).toFixed(1)} GB/s`;
  }
  if (bytesPerSec >= 1_000_000) {
    return `${(bytesPerSec / 1_000_000).toFixed(1)} MB/s`;
  }
  if (bytesPerSec >= 1_000) {
    return `${(bytesPerSec / 1_000).toFixed(1)} KB/s`;
  }
  return `${Math.round(bytesPerSec)} B/s`;
}
