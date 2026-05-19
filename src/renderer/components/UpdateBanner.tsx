import React, { useEffect, useState } from 'react';

type UpdateStatus =
  | { type: 'checking' }
  | { type: 'available';     version: string }
  | { type: 'not-available'; version: string }
  | { type: 'progress';      percent: number; bytesPerSecond: number; transferred: number; total: number }
  | { type: 'downloaded';    version: string }
  | { type: 'error';         message: string };

function fmtBytes(b: number): string {
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1_024)     return `${(b / 1_024).toFixed(0)} KB`;
  return `${b} B`;
}

const base: React.CSSProperties = {
  position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999,
  maxWidth: '340px', borderRadius: '10px', padding: '14px 18px',
  fontFamily: 'system-ui, sans-serif', fontSize: '0.88rem',
  boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
  transition: 'opacity 0.3s', display: 'flex', flexDirection: 'column', gap: '8px',
};

const themes: Record<string, React.CSSProperties> = {
  checking:        { ...base, background: '#1e293b', border: '1px solid #334155', color: '#94a3b8' },
  available:       { ...base, background: '#0c4a6e', border: '1px solid #0284c7', color: '#e0f2fe' },
  progress:        { ...base, background: '#0c4a6e', border: '1px solid #0284c7', color: '#e0f2fe' },
  downloaded:      { ...base, background: '#052e16', border: '1px solid #166534', color: '#bbf7d0' },
  'not-available': { ...base, background: '#1e293b', border: '1px solid #334155', color: '#64748b' },
  error:           { ...base, background: '#2d0a0a', border: '1px solid #991b1b', color: '#fca5a5' },
};

export const UpdateBanner: React.FC = () => {
  const [status,  setStatus]  = useState<UpdateStatus | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const unsub = window.electronAPI.updaterAPI.onStatus((s) => {
      setStatus(s);
      setVisible(true);
      if (s.type === 'not-available') {
        setTimeout(() => setVisible(false), 4_000);
      }
    });
    return unsub;
  }, []);

  if (!status || !visible) return null;

  const style = themes[status.type] ?? base;

  return (
    <div style={style} role="status" aria-live="polite">
      {status.type === 'checking' && (
        <span>🔄 Checking for updates…</span>
      )}

      {status.type === 'not-available' && (
        <span>✅ Network Tracker is up to date (v{status.version})</span>
      )}

      {status.type === 'available' && (
        <>
          <span>⬇ Update available — v{status.version}</span>
          <span style={{ fontSize: '0.8rem', color: '#7dd3fc' }}>Downloading in background…</span>
        </>
      )}

      {status.type === 'progress' && (
        <>
          <span>⬇ Downloading update — {status.percent}%</span>
          <div style={{ background: '#0a3554', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
            <div style={{ background: '#38bdf8', width: `${status.percent}%`, height: '100%', transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: '0.78rem', color: '#7dd3fc' }}>
            {fmtBytes(status.transferred)} / {fmtBytes(status.total)} at {fmtBytes(status.bytesPerSecond)}/s
          </span>
        </>
      )}

      {status.type === 'downloaded' && (
        <>
          <span>✅ Update v{status.version} ready to install</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => window.electronAPI.updaterAPI.install()}
              style={{
                padding: '6px 14px', borderRadius: '6px', border: 'none',
                background: '#166534', color: '#bbf7d0', fontWeight: 700,
                cursor: 'pointer', fontSize: '0.85rem',
              }}
            >Restart &amp; Update</button>
            <button
              onClick={() => setVisible(false)}
              style={{
                padding: '6px 14px', borderRadius: '6px', border: '1px solid #166534',
                background: 'transparent', color: '#86efac', cursor: 'pointer', fontSize: '0.85rem',
              }}
            >Later</button>
          </div>
        </>
      )}

      {status.type === 'error' && (
        <>
          <span>⚠️ Update error</span>
          <span style={{ fontSize: '0.8rem' }}>{status.message}</span>
          <button
            onClick={() => setVisible(false)}
            style={{
              alignSelf: 'flex-end', padding: '4px 10px', borderRadius: '4px',
              border: '1px solid #991b1b', background: 'transparent',
              color: '#fca5a5', cursor: 'pointer', fontSize: '0.8rem',
            }}
          >Dismiss</button>
        </>
      )}
    </div>
  );
};

export default UpdateBanner;
