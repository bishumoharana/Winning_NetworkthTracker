import { NetworkAdapter } from '../shared/types';
import { NetworkChangeEvent } from '../main/network/networkMonitor';

export {};

declare global {
  interface Window {
    electronAPI: {
      // Theme
      getTheme: () => Promise<string>;
      setTheme: (theme: 'dark' | 'light' | 'system') => Promise<string>;
      // Adapter detection (Task 1.2)
      getAdapters: () => Promise<NetworkAdapter[]>;
      getActiveAdapters: () => Promise<NetworkAdapter[]>;
      getPrimaryAdapter: () => Promise<NetworkAdapter | null>;
      // Real-time monitoring (Task 1.3)
      startMonitor: () => Promise<{ started: boolean }>;
      stopMonitor: () => Promise<{ stopped: boolean }>;
      getMonitorStatus: () => Promise<{ isRunning: boolean; adapters: NetworkAdapter[] }>;
      onNetworkChange: (callback: (events: NetworkChangeEvent[]) => void) => void;
      removeNetworkListeners: () => void;
    };
  }
}
