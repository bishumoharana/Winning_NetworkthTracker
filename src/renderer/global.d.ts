// Single canonical Window augmentation — matches preload.ts exactly.
// Do NOT redeclare electronAPI in individual component files.
import { NetworkAdapter, NetworkMetric } from '../shared/types';

export {};

type Theme = 'dark' | 'light' | 'system';
type Period = 'day' | 'week' | 'month';

interface AlertConfig {
  enabled:              boolean;
  downloadThresholdBps: number;
  uploadThresholdBps:   number;
}

interface ExportResult { filePath: string; rowCount: number; }
interface Adapter      { adapterId: string; adapterName: string; }

interface StatsRow {
  adapterId: string; adapterName: string; period: Period;
  totalBytesSent: number; totalBytesReceived: number;
  peakSpeedUp: number; peakSpeedDown: number;
  avgSpeedUp: number; avgSpeedDown: number;
  sampleCount: number;
}
interface SummaryRow {
  totalBytesSent: number; totalBytesReceived: number;
  peakSpeedUp: number; peakSpeedDown: number;
  avgSpeedUp: number; avgSpeedDown: number;
  sampleCount: number; adapterCount: number;
}

type UpdateStatus =
  | { type: 'checking' }
  | { type: 'available';      version: string }
  | { type: 'not-available';  version: string }
  | { type: 'progress';       percent: number; bytesPerSecond: number; transferred: number; total: number }
  | { type: 'downloaded';     version: string }
  | { type: 'error';          message: string };

declare global {
  interface Window {
    electronAPI: {
      // Network
      getAdapters:    () => Promise<NetworkAdapter[]>;
      getMetrics:     (adapterId: string) => Promise<NetworkMetric[]>;
      onMetricUpdate: (cb: (metrics: NetworkMetric[]) => void) => () => void;
      // Theme
      getTheme: () => Promise<string>;
      setTheme: (theme: Theme) => Promise<string>;
      // Alerts
      getAlertConfig:  () => Promise<AlertConfig>;
      saveAlertConfig: (config: AlertConfig) => Promise<{ ok: boolean }>;
      // Export
      exportAPI: {
        run:         (opts: object)  => Promise<ExportResult>;
        getAdapters: ()             => Promise<Adapter[]>;
      };
      // Startup
      startupAPI: {
        get: ()                 => Promise<boolean>;
        set: (enabled: boolean) => Promise<boolean>;
      };
      // Stats / History
      statsAPI: {
        get:        (period: Period, adapterId?: string) => Promise<StatsRow[]>;
        getSummary: (period: Period)                     => Promise<SummaryRow>;
      };
      // Updater
      updaterAPI: {
        check:    ()  => Promise<void>;
        install:  ()  => Promise<void>;
        onStatus: (cb: (s: UpdateStatus) => void) => () => void;
      };
    };
  }
}
