import { contextBridge, ipcRenderer } from 'electron';
import { NetworkAdapter, NetworkMetric, AggregatedMetric, IPC_CHANNELS } from '../shared/types';
import { AlertConfig } from './alerts/alertsService';

contextBridge.exposeInMainWorld('electronAPI', {
  // Theme
  getTheme: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.GET_THEME),
  setTheme: (theme: 'dark' | 'light' | 'system'): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_THEME, theme),

  // Adapters
  getAdapters: (): Promise<NetworkAdapter[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_ADAPTERS),
  getPrimaryAdapter: (): Promise<NetworkAdapter | null> => ipcRenderer.invoke('get-primary-adapter'),
  onNetworkChange: (callback: (adapters: NetworkAdapter[]) => void) => {
    ipcRenderer.on(IPC_CHANNELS.NETWORK_CHANGE, (_e, data) => callback(data));
  },
  removeNetworkListeners: () => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.NETWORK_CHANGE);
  },

  // Live metrics
  getLatestMetrics: (): Promise<NetworkMetric[]> => ipcRenderer.invoke('get-latest-metrics'),
  onNetworkMetric: (callback: (metrics: NetworkMetric[]) => void) => {
    ipcRenderer.on('network-metric', (_e, data) => callback(data));
  },
  removeMetricListeners: () => {
    ipcRenderer.removeAllListeners('network-metric');
  },

  // Historical DB
  getMetrics: (query?: { adapterName?: string; since?: number; until?: number; limit?: number })
    : Promise<NetworkMetric[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_METRICS, query),
  getMetricsSummary: (adapterName: string, since: number, until: number)
    : Promise<{ totalSent: number; totalReceived: number; peakSpeedUp: number; peakSpeedDown: number; rowCount: number }> =>
    ipcRenderer.invoke('get-metrics-summary', adapterName, since, until),
  getAggregated: (query?: { adapterName?: string; since?: number; until?: number })
    : Promise<AggregatedMetric[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_AGGREGATED, query),

  // Alerts
  getAlertConfig:  (): Promise<AlertConfig> => ipcRenderer.invoke('get-alert-config'),
  saveAlertConfig: (config: AlertConfig): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('save-alert-config', config),
});
