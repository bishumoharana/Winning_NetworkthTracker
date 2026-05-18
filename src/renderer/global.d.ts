import { NetworkAdapter, NetworkMetric, AggregatedMetric } from '../shared/types';

export {};

interface AlertConfig {
  enabled:              boolean;
  downloadThresholdBps: number;
  uploadThresholdBps:   number;
}

declare global {
  interface Window {
    electronAPI: {
      // Theme
      getTheme: () => Promise<string>;
      setTheme: (theme: 'dark' | 'light' | 'system') => Promise<string>;
      // Adapters
      getAdapters: () => Promise<NetworkAdapter[]>;
      getPrimaryAdapter: () => Promise<NetworkAdapter | null>;
      onNetworkChange: (callback: (adapters: NetworkAdapter[]) => void) => void;
      removeNetworkListeners: () => void;
      // Live metrics
      getLatestMetrics: () => Promise<NetworkMetric[]>;
      onNetworkMetric: (callback: (metrics: NetworkMetric[]) => void) => void;
      removeMetricListeners: () => void;
      // Historical DB
      getMetrics: (query?: { adapterName?: string; since?: number; until?: number; limit?: number }) => Promise<NetworkMetric[]>;
      getMetricsSummary: (adapterName: string, since: number, until: number) => Promise<{ totalSent: number; totalReceived: number; peakSpeedUp: number; peakSpeedDown: number; rowCount: number }>;
      getAggregated: (query?: { adapterName?: string; since?: number; until?: number }) => Promise<AggregatedMetric[]>;
      // Alerts
      getAlertConfig:  () => Promise<AlertConfig>;
      saveAlertConfig: (config: AlertConfig) => Promise<{ ok: boolean }>;
    };
  }
}
