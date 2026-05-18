import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, NetworkMetric } from './shared/types';
import { ExportOptions, ExportResult } from './main/export/exportService';
import { Period, StatsRow, SummaryRow } from './main/stats/statsService';

contextBridge.exposeInMainWorld('electronAPI', {
  // Network
  getAdapters:    ()                  => ipcRenderer.invoke(IPC_CHANNELS.GET_ADAPTERS),
  getMetrics:     (adapterId: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_METRICS, adapterId),
  onMetricUpdate: (cb: (metrics: NetworkMetric[]) => void) => {
    const handler = (_: unknown, data: NetworkMetric[]) => cb(data);
    ipcRenderer.on('network-metric', handler);
    return () => ipcRenderer.removeListener('network-metric', handler);
  },

  // Alerts
  getAlertConfig:  ()            => ipcRenderer.invoke('alerts:get-config'),
  saveAlertConfig: (cfg: unknown) => ipcRenderer.invoke('alerts:save-config', cfg),

  // Export
  exportAPI: {
    run:         (opts: ExportOptions) => ipcRenderer.invoke('export:run', opts) as Promise<ExportResult>,
    getAdapters: ()                    => ipcRenderer.invoke('export:get-adapters') as Promise<{ adapterId: string; adapterName: string }[]>,
  },

  // Startup
  startupAPI: {
    get: ()                 => ipcRenderer.invoke('startup:get') as Promise<boolean>,
    set: (enabled: boolean) => ipcRenderer.invoke('startup:set', enabled) as Promise<boolean>,
  },

  // Stats / History
  statsAPI: {
    get:        (period: Period, adapterId?: string) => ipcRenderer.invoke('stats:get', period, adapterId) as Promise<StatsRow[]>,
    getSummary: (period: Period)                     => ipcRenderer.invoke('stats:summary', period) as Promise<SummaryRow>,
  },

  // Theme
  getTheme: ()                               => ipcRenderer.invoke(IPC_CHANNELS.GET_THEME),
  setTheme: (theme: 'dark'|'light'|'system') => ipcRenderer.invoke(IPC_CHANNELS.SET_THEME, theme),
});
