import React, { useEffect, useState } from 'react';

declare global {
  interface Window {
    electronAPI: {
      startupAPI: {
        get: () => Promise<boolean>;
        set: (enabled: boolean) => Promise<boolean>;
      };
    };
  }
}

const s: Record<string, React.CSSProperties> = {
  panel:    { padding: '32px', maxWidth: '520px', fontFamily: 'system-ui, sans-serif', color: '#e2e8f0' },
  heading:  { fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px', color: '#f8fafc' },
  sub:      { fontSize: '0.85rem', color: '#64748b', marginBottom: '32px' },
  card:     { background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '20px 24px', marginBottom: '16px' },
  row:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' },
  label:    { fontSize: '0.95rem', fontWeight: 600, color: '#f1f5f9' },
  desc:     { fontSize: '0.8rem', color: '#64748b', marginTop: '4px' },
  track:    (on: boolean): React.CSSProperties => ({
    position: 'relative', width: '44px', height: '24px', borderRadius: '12px',
    background: on ? '#0284c7' : '#334155',
    border: 'none', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
  }),
  thumb:    (on: boolean): React.CSSProperties => ({
    position: 'absolute', top: '3px',
    left: on ? '23px' : '3px',
    width: '18px', height: '18px', borderRadius: '50%',
    background: '#fff', transition: 'left 0.2s',
  }),
  feedback: (ok: boolean): React.CSSProperties => ({
    marginTop: '12px', padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem',
    background: ok ? '#052e16' : '#2d0a0a',
    border: `1px solid ${ok ? '#166534' : '#991b1b'}`,
    color: ok ? '#4ade80' : '#f87171',
  }),
};

export const SettingsPanel: React.FC = () => {
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [feedback,      setFeedback]      = useState<{ ok: boolean; msg: string } | null>(null);
  const platform = typeof navigator !== 'undefined'
    ? navigator.userAgent.includes('Mac') ? 'macOS'
    : navigator.userAgent.includes('Win') ? 'Windows'
    : 'Linux'
    : 'Unknown';

  useEffect(() => {
    window.electronAPI.startupAPI.get()
      .then(setLaunchAtLogin)
      .catch(() => setLaunchAtLogin(false));
  }, []);

  const toggle = async () => {
    const next = !launchAtLogin;
    setSaving(true); setFeedback(null);
    try {
      const confirmed = await window.electronAPI.startupAPI.set(next);
      setLaunchAtLogin(confirmed);
      setFeedback({ ok: true, msg: confirmed ? '✅ Will launch at login' : '✅ Auto-launch disabled' });
    } catch (err: unknown) {
      setFeedback({ ok: false, msg: `⚠️ ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  return (
    <div style={s.panel}>
      <div style={s.heading}>Settings</div>
      <div style={s.sub}>Platform detected: {platform}</div>

      <div style={s.card}>
        <div style={s.row}>
          <div>
            <div style={s.label}>Launch at login</div>
            <div style={s.desc}>
              Start Network Tracker automatically when you log in.
              The app opens minimised to the system tray.
            </div>
          </div>
          <button
            style={s.track(launchAtLogin)}
            onClick={toggle}
            disabled={saving}
            aria-label={launchAtLogin ? 'Disable launch at login' : 'Enable launch at login'}
            aria-pressed={launchAtLogin}
          >
            <span style={s.thumb(launchAtLogin)} />
          </button>
        </div>
        {feedback && <div style={s.feedback(feedback.ok)}>{feedback.msg}</div>}
      </div>
    </div>
  );
};

export default SettingsPanel;
