import { contextBridge, ipcRenderer } from 'electron';

// Expose safe APIs to renderer process via window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  // Theme
  getTheme: (): Promise<string> => ipcRenderer.invoke('get-theme'),
  setTheme: (theme: 'dark' | 'light' | 'system'): Promise<string> =>
    ipcRenderer.invoke('set-theme', theme),

  // Network (stubs — to be implemented in Task 1.2 & 1.3)
  getAdapters: (): Promise<unknown> => ipcRenderer.invoke('get-adapters'),
  onNetworkChange: (callback: (data: unknown) => void) => {
    ipcRenderer.on('network-change', (_event, data) => callback(data));
  },
  removeNetworkListeners: () => {
    ipcRenderer.removeAllListeners('network-change');
  },
});
