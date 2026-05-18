import { BrowserWindow } from 'electron';
import { NetworkAdapter, IPC_CHANNELS } from '../../shared/types';
import { getNetworkAdapters } from './adapterDetector';

export type NetworkChangeEvent = {
  type: 'adapter-added' | 'adapter-removed' | 'status-changed' | 'primary-changed';
  adapter: NetworkAdapter;
  previousStatus?: NetworkAdapter['status'];
};

export type NetworkSnapshot = Map<string, NetworkAdapter>;

/**
 * NetworkMonitor polls network adapters at a configurable interval,
 * computes diffs between snapshots, and emits IPC events to all renderer windows.
 */
export class NetworkMonitor {
  private intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private lastSnapshot: NetworkSnapshot = new Map();
  private primaryAdapterName: string | null = null;
  private _isRunning = false;

  constructor(intervalMs = 1000) {
    this.intervalMs = intervalMs;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Start monitoring. Takes an initial snapshot immediately, then polls.
   */
  start(): void {
    if (this._isRunning) return;
    this._isRunning = true;

    // Take initial snapshot without emitting events
    const initial = getNetworkAdapters();
    this.lastSnapshot = this.toSnapshot(initial);
    this.primaryAdapterName = this.getPrimaryName(initial);

    this.timer = setInterval(() => this.poll(), this.intervalMs);
  }

  /**
   * Stop monitoring and clear the interval.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this._isRunning = false;
  }

  /**
   * Poll adapters and emit change events if diff detected.
   * Exposed for testing.
   */
  poll(): NetworkChangeEvent[] {
    const current = getNetworkAdapters();
    const currentSnapshot = this.toSnapshot(current);
    const events = this.computeDiff(this.lastSnapshot, currentSnapshot);

    // Check for primary adapter change
    const newPrimary = this.getPrimaryName(current);
    if (newPrimary !== this.primaryAdapterName) {
      const adapter = current.find((a) => a.name === newPrimary);
      if (adapter) {
        events.push({ type: 'primary-changed', adapter });
      }
      this.primaryAdapterName = newPrimary;
    }

    if (events.length > 0) {
      this.lastSnapshot = currentSnapshot;
      this.broadcastEvents(events);
    }

    return events;
  }

  /**
   * Computes the diff between two adapter snapshots.
   */
  computeDiff(
    prev: NetworkSnapshot,
    curr: NetworkSnapshot
  ): NetworkChangeEvent[] {
    const events: NetworkChangeEvent[] = [];

    // Check for added or status-changed adapters
    for (const [name, adapter] of curr) {
      const previous = prev.get(name);
      if (!previous) {
        events.push({ type: 'adapter-added', adapter });
      } else if (previous.status !== adapter.status) {
        events.push({
          type: 'status-changed',
          adapter,
          previousStatus: previous.status,
        });
      }
    }

    // Check for removed adapters
    for (const [name, adapter] of prev) {
      if (!curr.has(name)) {
        events.push({ type: 'adapter-removed', adapter });
      }
    }

    return events;
  }

  /**
   * Broadcasts change events to all open renderer windows via IPC.
   */
  private broadcastEvents(events: NetworkChangeEvent[]): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.NETWORK_CHANGE, events);
      }
    }
  }

  private toSnapshot(adapters: NetworkAdapter[]): NetworkSnapshot {
    return new Map(adapters.map((a) => [a.name, a]));
  }

  private getPrimaryName(adapters: NetworkAdapter[]): string | null {
    const active = adapters.filter((a) => a.status === 'active');
    if (active.length === 0) return null;
    const eth = active.find((a) => a.type === 'ethernet');
    return eth?.name ?? active.find((a) => a.type === 'wifi')?.name ?? active[0].name;
  }

  /**
   * Expose current snapshot (for testing / IPC queries).
   */
  getCurrentAdapters(): NetworkAdapter[] {
    return Array.from(this.lastSnapshot.values());
  }

  /**
   * Force-update snapshot (used in tests).
   */
  setSnapshot(adapters: NetworkAdapter[]): void {
    this.lastSnapshot = this.toSnapshot(adapters);
  }
}

// Singleton instance used by the main process
export const networkMonitor = new NetworkMonitor(1000);
