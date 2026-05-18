import React, { useEffect, useState } from 'react';

interface AlertConfig {
  enabled:              boolean;
  downloadThresholdBps: number;
  uploadThresholdBps:   number;
}

function bpsToMbps(bps: number): string {
  return bps > 0 ? (bps / 1_048_576).toFixed(2) : '';
}

function mbpsToBps(mbps: string): number {
  const v = parseFloat(mbps);
  return isNaN(v) || v <= 0 ? 0 : Math.round(v * 1_048_576);
}

const AlertsSettings: React.FC = () => {
  const [config,    setConfig]   = useState<AlertConfig>({ enabled: false, downloadThresholdBps: 0, uploadThresholdBps: 0 });
  const [dlInput,   setDlInput]  = useState('');
  const [ulInput,   setUlInput]  = useState('');
  const [saving,    setSaving]   = useState(false);
  const [feedback,  setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    window.electronAPI?.getAlertConfig().then((cfg) => {
      setConfig(cfg);
      setDlInput(bpsToMbps(cfg.downloadThresholdBps));
      setUlInput(bpsToMbps(cfg.uploadThresholdBps));
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const next: AlertConfig = {
        enabled:              config.enabled,
        downloadThresholdBps: mbpsToBps(dlInput),
        uploadThresholdBps:   mbpsToBps(ulInput),
      };
      await window.electronAPI?.saveAlertConfig(next);
      setConfig(next);
      setFeedback({ type: 'success', msg: 'Alert settings saved.' });
    } catch (err) {
      setFeedback({ type: 'error', msg: 'Failed to save settings.' });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  return (
    <div className="alerts-panel">
      <h2 className="section-title">Alert Settings</h2>

      <div className="alerts-form">
        {/* Enable toggle */}
        <div className="alerts-row">
          <label className="alerts-label" htmlFor="alerts-enabled">
            Enable Speed Alerts
          </label>
          <label className="toggle-switch">
            <input
              id="alerts-enabled"
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig((c) => ({ ...c, enabled: e.target.checked }))}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <p className="alerts-hint">
          Receive a desktop notification when network speed drops below your set threshold.
          Leave a field empty or set to 0 to disable that check.
        </p>

        {/* Download threshold */}
        <div className={`alerts-row threshold-row ${!config.enabled ? 'disabled' : ''}`}>
          <label className="alerts-label" htmlFor="dl-threshold">
            ↓ Download threshold (MB/s)
          </label>
          <input
            id="dl-threshold"
            type="number"
            min="0"
            step="0.1"
            placeholder="e.g. 1.0"
            className="threshold-input"
            value={dlInput}
            disabled={!config.enabled}
            onChange={(e) => setDlInput(e.target.value)}
          />
        </div>

        {/* Upload threshold */}
        <div className={`alerts-row threshold-row ${!config.enabled ? 'disabled' : ''}`}>
          <label className="alerts-label" htmlFor="ul-threshold">
            ↑ Upload threshold (MB/s)
          </label>
          <input
            id="ul-threshold"
            type="number"
            min="0"
            step="0.1"
            placeholder="e.g. 0.5"
            className="threshold-input"
            value={ulInput}
            disabled={!config.enabled}
            onChange={(e) => setUlInput(e.target.value)}
          />
        </div>

        {/* Save */}
        <div className="alerts-actions">
          <button
            className="save-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          {feedback && (
            <span className={`alerts-feedback ${feedback.type}`}>
              {feedback.type === 'success' ? '✅' : '⚠️'} {feedback.msg}
            </span>
          )}
        </div>

        <p className="alerts-note">
          ⚠️ Notifications fire at most once per adapter per 60 seconds to avoid spam.
        </p>
      </div>
    </div>
  );
};

export default AlertsSettings;
