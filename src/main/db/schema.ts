/**
 * SQLite schema definitions for Network Tracker.
 * All CREATE TABLE / CREATE INDEX statements live here.
 */

export const CREATE_NETWORK_METRICS = `
  CREATE TABLE IF NOT EXISTS network_metrics (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    adapter_name    TEXT    NOT NULL,
    adapter_mac     TEXT    NOT NULL DEFAULT '',
    timestamp       INTEGER NOT NULL,
    bytes_sent      INTEGER NOT NULL DEFAULT 0,
    bytes_received  INTEGER NOT NULL DEFAULT 0,
    speed_up        REAL    NOT NULL DEFAULT 0,
    speed_down      REAL    NOT NULL DEFAULT 0
  ) STRICT;
`;

export const CREATE_NETWORK_METRICS_IDX_TIMESTAMP = `
  CREATE INDEX IF NOT EXISTS idx_metrics_timestamp
  ON network_metrics (timestamp);
`;

export const CREATE_NETWORK_METRICS_IDX_ADAPTER = `
  CREATE INDEX IF NOT EXISTS idx_metrics_adapter_ts
  ON network_metrics (adapter_name, timestamp);
`;

export const CREATE_AGGREGATED_METRICS = `
  CREATE TABLE IF NOT EXISTS aggregated_metrics (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    adapter_name    TEXT    NOT NULL,
    interval_start  INTEGER NOT NULL,
    interval_end    INTEGER NOT NULL,
    total_sent      INTEGER NOT NULL DEFAULT 0,
    total_received  INTEGER NOT NULL DEFAULT 0,
    avg_speed_up    REAL    NOT NULL DEFAULT 0,
    avg_speed_down  REAL    NOT NULL DEFAULT 0,
    peak_speed_up   REAL    NOT NULL DEFAULT 0,
    peak_speed_down REAL    NOT NULL DEFAULT 0,
    UNIQUE (adapter_name, interval_start)
  ) STRICT;
`;

export const CREATE_AGGREGATED_IDX = `
  CREATE INDEX IF NOT EXISTS idx_agg_adapter_start
  ON aggregated_metrics (adapter_name, interval_start);
`;

export const CREATE_APP_CONFIG = `
  CREATE TABLE IF NOT EXISTS app_config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  ) STRICT;
`;

/** Default config values inserted on first run. */
export const DEFAULT_CONFIG: Record<string, string> = {
  theme:                        'dark',
  aggregationIntervalMinutes:   '120',
  dataDisplayUnit:              'auto',
  retentionDaysRaw:             '7',
  retentionDaysAggregated:      '90',
  alertsEnabled:                'false',
  launchOnStartup:              'false',
  // ms-based keys read by readRetentionConfig
  retention_raw_ms:             String(7  * 24 * 60 * 60 * 1000),
  retention_aggregated_ms:      String(90 * 24 * 60 * 60 * 1000),
  aggregation_window_ms:        String(2  * 60 * 60 * 1000),
};
