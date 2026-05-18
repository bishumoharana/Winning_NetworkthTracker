import { contextBridge, ipcRenderer } from 'electron';
import { NetworkAdapter, NetworkChangeEvent } from './network/networkMonitor';

contextBridge.exposeInMainWorld('electronAPI', {
  // Theme
  getTheme: (): Promise<string> => ipcRenderer.invoke('get-theme'),
  setTheme: (theme: 'dark' | 'light' | 'system'): Promise<string> =>
    ipcRenderer.invoke('set-theme', theme),

  // Network - point in time
  getAdapters: (): Promise<NetworkAdapter[]> =>
    ipcRenderer.invoke('get-adapters'),
  getActiveAdapters: (): Promise<NetworkAdapter[]> =>
    ipcRenderer.invoke('get-active-adapters'),
  getPrimaryAdapter: (): Promise<NetworkAdapter | null> =>
    ipcRenderer.invoke('get-primary-adapter'),

  // Network - real-time monitor
  startNetworkMonitor: (): Promise<{ started: boolean }> =>
    ipcRenderer.invoke('start-network-monitor'),
  stopNetworkMonitor: (): Promise<{ stopped: boolean }> =>
    ipcRenderer.invoke('stop-network-monitor'),
  getMonitorStatus: (): Promise<{ isRunning: boolean; adapters: NetworkAdapter[] }> =>
    ipcRenderer.invoke('get-monitor-status'),

  // Network change event subscription
  onNetworkChange: (callback: (events: NetworkChangeEvent[]) => void): void => {
    ipcRenderer.on('network-change', (_event, events) => callback(events));
  },
  removeNetworkListeners: (): void => {
    ipcRenderer.removeAllListeners('network-change');
  },
});
