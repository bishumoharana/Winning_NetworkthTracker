import { NetworkAdapter, NetworkMetric } from '../shared/types';

export {};

declare global {
  interface Window {
    electronAPI: {
      // Theme
      getTheme: () => Promise<string>;
      setTheme: (theme: 'dark' | 'light' | 'system') => Promise<string>;
      // Adapter detection (Task 1.2)
      getAdapters: () => Promise<NetworkAdapter[]>;
      getPrimaryAdapter: () => Promise<NetworkAdapter | null>;
      // Real-time adapter change events (Task 1.3)
      onNetworkChange: (callback: (adapters: NetworkAdapter[]) => void) => void;
      removeNetworkListeners: () => void;
      // Live traffic metrics (Task 2.1)
      getLatestMetrics: () => Promise<NetworkMetric[]>;
      onNetworkMetric: (callback: (metrics: NetworkMetric[]) => void) => void;
      removeMetricListeners: () => void;
    };
  }
}
