import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, NetworkMetric, AggregatedMetric } from './shared/types';
import { ExportOptions, ExportResult } from './main/export/exportService';
import { Period, StatsRow, SummaryRow } from './main/stats/statsService';
import { UpdateStatus } from './main/updater/updaterService';

// Typed query shapes that the renderer passes to getMetrics / getAggregated
export interface MetricsQuery {
  adapterName?: string;
  since?:       number;
  until?:       number;
  limit?:       number;
}

export interface AggregatedQuery {
  adapterName?: string;
  since?:       number;
  until?:       number;
}

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Network adapters ───────────────────────────────────────────────────
  getAdapters: () => ipcRenderer.invoke(IPC_CHANNELS.GET_ADAPTERS),

  // getMetrics now accepts either the legacy (adapterId: string) call
  // OR the newer object-style query used by useHistoricalMetrics.
  getMetrics: (queryOrId: string | MetricsQuery) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.GET_METRICS,
      typeof queryOrId === 'string' ? { adapterName: queryOrId } : queryOrId,
    ),

  // getAggregated — used by useHistoricalMetrics for the 7-day view
  getAggregated: (query: AggregatedQuery) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_AGGREGATED, query) as Promise<AggregatedMetric[]>,

  // ── Live-metric push events ────────────────────────────────────────────
  // Called by App.tsx: window.electronAPI.onNetworkMetric(cb)
  onNetworkMetric: (cb: (metrics: NetworkMetric[]) => void) => {
    const handler = (_: unknown, data: NetworkMetric[]) => cb(data);
    ipcRenderer.on('network-metric', handler);
    return () => ipcRenderer.removeListener('network-metric', handler);
  },

  // onMetricUpdate kept as alias so any existing callers don't break
  onMetricUpdate: (cb: (metrics: NetworkMetric[]) => void) => {
    const handler = (_: unknown, data: NetworkMetric[]) => cb(data);
    ipcRenderer.on('network-metric', handler);
    return () => ipcRenderer.removeListener('network-metric', handler);
  },

  // Called by App.tsx: window.electronAPI.onNetworkChange(cb)
  onNetworkChange: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on(IPC_CHANNELS.NETWORK_CHANGE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.NETWORK_CHANGE, handler);
  },

  // Bulk-remove helpers called in App.tsx cleanup (return of useEffect)
  removeNetworkListeners: () => ipcRenderer.removeAllListeners(IPC_CHANNELS.NETWORK_CHANGE),
  removeMetricListeners:  () => ipcRenderer.removeAllListeners('network-metric'),

  // ── Alerts ─────────────────────────────────────────────────────────────
  getAlertConfig:  ()             => ipcRenderer.invoke('alerts:get-config'),
  saveAlertConfig: (cfg: unknown) => ipcRenderer.invoke('alerts:save-config', cfg),

  // ── Export ─────────────────────────────────────────────────────────────
  exportAPI: {
    run:         (opts: ExportOptions) => ipcRenderer.invoke('export:run', opts) as Promise<ExportResult>,
    getAdapters: ()                    => ipcRenderer.invoke('export:get-adapters') as Promise<{ adapterId: string; adapterName: string }[]>,
  },

  // ── Startup ────────────────────────────────────────────────────────────
  startupAPI: {
    get: ()                 => ipcRenderer.invoke('startup:get') as Promise<boolean>,
    set: (enabled: boolean) => ipcRenderer.invoke('startup:set', enabled) as Promise<boolean>,
  },

  // ── Stats / History ────────────────────────────────────────────────────
  statsAPI: {
    get:        (period: Period, adapterId?: string) => ipcRenderer.invoke('stats:get', period, adapterId) as Promise<StatsRow[]>,
    getSummary: (period: Period)                     => ipcRenderer.invoke('stats:summary', period) as Promise<SummaryRow>,
  },

  // ── Updater ────────────────────────────────────────────────────────────
  updaterAPI: {
    check:    ()  => ipcRenderer.invoke('updater:check'),
    install:  ()  => ipcRenderer.invoke('updater:install'),
    onStatus: (cb: (status: UpdateStatus) => void) => {
      const handler = (_: unknown, status: UpdateStatus) => cb(status);
      ipcRenderer.on('updater:status', handler);
      return () => ipcRenderer.removeListener('updater:status', handler);
    },
  },

  // ── Theme ──────────────────────────────────────────────────────────────
  getTheme: ()                               => ipcRenderer.invoke(IPC_CHANNELS.GET_THEME),
  setTheme: (theme: 'dark'|'light'|'system') => ipcRenderer.invoke(IPC_CHANNELS.SET_THEME, theme),
});
