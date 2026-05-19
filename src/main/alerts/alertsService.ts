/**
 * Alerts Service — Issue #19
 *
 * Evaluates live NetworkMetrics against user-configured thresholds
 * and fires Electron Notifications when a threshold is crossed.
 * A 60-second cooldown per adapter prevents notification spam.
 */
import { Notification } from 'electron';
import { getDb } from '../db/database';
import { NetworkMetric } from '../../shared/types';

export interface AlertConfig {
  enabled:               boolean;
  downloadThresholdBps:  number; // 0 = disabled
  uploadThresholdBps:    number; // 0 = disabled
}

const DEFAULT_CONFIG: AlertConfig = {
  enabled:              false,
  downloadThresholdBps: 0,
  uploadThresholdBps:   0,
};

/**
 * Cooldown map: adapterName -> last notification epoch ms.
 * Initialised to -Infinity so the very first evaluation always fires
 * regardless of what `now` value is passed (including small values in tests).
 */
const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 60_000; // 60 seconds

// ---------------------------------------------------------------------------
// Config persistence
// ---------------------------------------------------------------------------

export function getAlertConfig(): AlertConfig {
  try {
    const db = getDb();
    const rows = db.prepare(
      `SELECT key, value FROM app_config WHERE key IN
       ('alertsEnabled','alertDownloadThresholdBps','alertUploadThresholdBps')`
    ).all() as Array<{ key: string; value: string }>;

    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;

    return {
      enabled:              map['alertsEnabled'] === 'true',
      downloadThresholdBps: parseInt(map['alertDownloadThresholdBps'] ?? '0', 10) || 0,
      uploadThresholdBps:   parseInt(map['alertUploadThresholdBps']   ?? '0', 10) || 0,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveAlertConfig(config: AlertConfig): void {
  const db = getDb();
  const upsert = db.prepare(
    `INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)`
  );
  const save = db.transaction(() => {
    upsert.run('alertsEnabled',              String(config.enabled));
    upsert.run('alertDownloadThresholdBps',  String(config.downloadThresholdBps));
    upsert.run('alertUploadThresholdBps',    String(config.uploadThresholdBps));
  });
  save();
}

// ---------------------------------------------------------------------------
// Threshold evaluation
// ---------------------------------------------------------------------------

export interface AlertFired {
  adapterName: string;
  type:        'download' | 'upload';
  actual:      number;
  threshold:   number;
}

/**
 * Evaluates a batch of live metrics against the current alert config.
 * Fires Electron Notifications for any threshold breach (with cooldown).
 * Returns list of alerts fired (useful for testing without real Notifications).
 */
export function evaluateMetrics(
  metrics:  NetworkMetric[],
  config:   AlertConfig,
  now = Date.now(),
): AlertFired[] {
  if (!config.enabled) return [];

  const fired: AlertFired[] = [];

  for (const m of metrics) {
    const cooldownKey = m.adapterName;
    // FIX: use -Infinity as the default so the very first call always passes
    // the cooldown check regardless of how small `now` is (e.g. now=1000 in tests).
    const lastFired   = cooldowns.get(cooldownKey) ?? -Infinity;
    if (now - lastFired < COOLDOWN_MS) continue; // still in cooldown

    let shouldFire = false;
    let alert: AlertFired | null = null;

    // Download threshold check (speed is too LOW — alert when BELOW threshold)
    if (config.downloadThresholdBps > 0 && m.speedDown < config.downloadThresholdBps) {
      shouldFire = true;
      alert = {
        adapterName: m.adapterName,
        type:        'download',
        actual:      m.speedDown,
        threshold:   config.downloadThresholdBps,
      };
    }

    // Upload threshold check (speed is too LOW)
    if (!shouldFire && config.uploadThresholdBps > 0 && m.speedUp < config.uploadThresholdBps) {
      shouldFire = true;
      alert = {
        adapterName: m.adapterName,
        type:        'upload',
        actual:      m.speedUp,
        threshold:   config.uploadThresholdBps,
      };
    }

    if (shouldFire && alert) {
      cooldowns.set(cooldownKey, now);
      fired.push(alert);
      fireNotification(alert);
    }
  }

  return fired;
}

function formatBps(bps: number): string {
  if (bps >= 1_048_576) return `${(bps / 1_048_576).toFixed(1)} MB/s`;
  if (bps >= 1_024)     return `${(bps / 1_024).toFixed(0)} KB/s`;
  return `${bps.toFixed(0)} B/s`;
}

function fireNotification(alert: AlertFired): void {
  if (!Notification.isSupported()) return;
  const direction = alert.type === 'download' ? '↓ Download' : '↑ Upload';
  new Notification({
    title: `⚠️ Network Speed Alert — ${alert.adapterName}`,
    body:  `${direction} speed dropped to ${formatBps(alert.actual)} ` +
           `(threshold: ${formatBps(alert.threshold)})`,
    silent: false,
  }).show();
}

/** Reset cooldowns — FOR TESTING ONLY. */
export function _resetCooldowns(): void {
  cooldowns.clear();
}
