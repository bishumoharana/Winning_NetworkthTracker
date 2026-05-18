// Shared TypeScript interfaces used across main and renderer processes

export interface NetworkAdapter {
  name: string;
  mac: string;
  type: 'wifi' | 'ethernet' | 'cellular' | 'unknown';
  status: 'active' | 'standby' | 'inactive';
  ipv4?: string;
  ipv6?: string;
}

export interface NetworkMetric {
  adapterId: string;
  adapterName: string;
  timestamp: number; // Unix epoch ms
  bytesSent: number;
  bytesReceived: number;
  speedUp: number;   // bytes/sec
  speedDown: number; // bytes/sec
}

export interface AggregatedMetric {
  adapterName: string;
  intervalStart: number;
  intervalEnd: number;
  totalSent: number;
  totalReceived: number;
  avgSpeedUp: number;
  avgSpeedDown: number;
  peakSpeedUp: number;
  peakSpeedDown: number;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  aggregationIntervalMinutes: number; // default: 120
  dataDisplayUnit: 'auto' | 'bytes' | 'kb' | 'mb' | 'gb';
  retentionDays: number;              // default: 7 for raw, 90 for aggregated
  alertsEnabled: boolean;
  launchOnStartup: boolean;
}

export type Theme = 'dark' | 'light';

// Electron IPC channel names (type-safe constants)
export const IPC_CHANNELS = {
  GET_THEME: 'get-theme',
  SET_THEME: 'set-theme',
  GET_ADAPTERS: 'get-adapters',
  NETWORK_CHANGE: 'network-change',
  GET_METRICS: 'get-metrics',
  GET_AGGREGATED: 'get-aggregated',
  GET_SETTINGS: 'get-settings',
  SET_SETTINGS: 'set-settings',
  EXPORT_CSV: 'export-csv',
} as const;
