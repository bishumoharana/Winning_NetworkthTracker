import { contextBridge, ipcRenderer } from 'electron';
import { NetworkAdapter, NetworkMetric, IPC_CHANNELS } from '../shared/types';

// Expose safe APIs to renderer process via window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  // Theme
  getTheme: (): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_THEME),
  setTheme: (theme: 'dark' | 'light' | 'system'): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_THEME, theme),

  // Adapter detection (Task 1.2)
  getAdapters: (): Promise<NetworkAdapter[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_ADAPTERS),
  getPrimaryAdapter: (): Promise<NetworkAdapter | null> =>
    ipcRenderer.invoke('get-primary-adapter'),

  // Real-time adapter change events (Task 1.3)
  onNetworkChange: (callback: (adapters: NetworkAdapter[]) => void) => {
    ipcRenderer.on(IPC_CHANNELS.NETWORK_CHANGE, (_event, data) => callback(data));
  },
  removeNetworkListeners: () => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.NETWORK_CHANGE);
  },

  // Live traffic metrics (Task 2.1)
  getLatestMetrics: (): Promise<NetworkMetric[]> =>
    ipcRenderer.invoke('get-latest-metrics'),
  onNetworkMetric: (callback: (metrics: NetworkMetric[]) => void) => {
    ipcRenderer.on(IPC_CHANNELS.NETWORK_METRIC, (_event, data) => callback(data));
  },
  removeMetricListeners: () => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.NETWORK_METRIC);
  },
});
