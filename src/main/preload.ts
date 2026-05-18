import { contextBridge, ipcRenderer } from 'electron';
import { NetworkAdapter, IPC_CHANNELS } from '../shared/types';
import { NetworkChangeEvent } from './network/networkMonitor';

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Theme ──────────────────────────────────────────────────────────────
  getTheme: (): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_THEME),
  setTheme: (theme: 'dark' | 'light' | 'system'): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_THEME, theme),

  // ── Adapter detection (Task 1.2) ────────────────────────────────────────
  getAdapters: (): Promise<NetworkAdapter[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_ADAPTERS),
  getActiveAdapters: (): Promise<NetworkAdapter[]> =>
    ipcRenderer.invoke('get-active-adapters'),
  getPrimaryAdapter: (): Promise<NetworkAdapter | null> =>
    ipcRenderer.invoke('get-primary-adapter'),

  // ── Real-time monitoring (Task 1.3) ─────────────────────────────────────
  startMonitor: (): Promise<{ started: boolean }> =>
    ipcRenderer.invoke('start-network-monitor'),
  stopMonitor: (): Promise<{ stopped: boolean }> =>
    ipcRenderer.invoke('stop-network-monitor'),
  getMonitorStatus: (): Promise<{ isRunning: boolean; adapters: NetworkAdapter[] }> =>
    ipcRenderer.invoke('get-monitor-status'),

  onNetworkChange: (callback: (events: NetworkChangeEvent[]) => void): void => {
    ipcRenderer.on(IPC_CHANNELS.NETWORK_CHANGE, (_event, data: NetworkChangeEvent[]) =>
      callback(data)
    );
  },
  removeNetworkListeners: (): void => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.NETWORK_CHANGE);
  },
});
