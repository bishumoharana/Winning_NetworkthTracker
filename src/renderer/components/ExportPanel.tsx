import React, { useEffect, useState } from 'react';

type Format = 'csv' | 'json';

interface Adapter { adapterId: string; adapterName: string; }

interface ExportResult { filePath: string; rowCount: number; }

declare global {
  interface Window {
    electronAPI: {
      exportAPI: {
        run: (opts: object) => Promise<ExportResult>;
        getAdapters: () => Promise<Adapter[]>;
      };
    };
  }
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    padding: '32px',
    maxWidth: '560px',
    fontFamily: 'system-ui, sans-serif',
    color: '#e2e8f0',
  },
  heading: { fontSize: '1.25rem', fontWeight: 700, marginBottom: '24px', color: '#f8fafc' },
  label:   { display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  field:   { marginBottom: '20px' },
  select:  { width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', fontSize: '0.95rem' },
  input:   { width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', fontSize: '0.95rem' },
  fmtRow:  { display: 'flex', gap: '12px', marginBottom: '24px' },
  fmtBtn:  (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid',
    borderColor: active ? '#38bdf8' : '#334155',
    background: active ? '#0c4a6e' : '#1e293b',
    color: active ? '#f0f9ff' : '#94a3b8',
    fontWeight: active ? 700 : 400, cursor: 'pointer', fontSize: '0.95rem',
  }),
  exportBtn: {
    width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
    background: '#0284c7', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
  },
  success: { marginTop: '16px', padding: '12px 16px', borderRadius: '6px', background: '#052e16', border: '1px solid #166534', color: '#4ade80', fontSize: '0.88rem', wordBreak: 'break-all' },
  error:   { marginTop: '16px', padding: '12px 16px', borderRadius: '6px', background: '#2d0a0a', border: '1px solid #991b1b', color: '#f87171', fontSize: '0.88rem' },
};

export const ExportPanel: React.FC = () => {
  const [adapters,  setAdapters]  = useState<Adapter[]>([]);
  const [adapterId, setAdapterId] = useState<string>('');
  const [fromDate,  setFromDate]  = useState<string>('');
  const [toDate,    setToDate]    = useState<string>('');
  const [format,    setFormat]    = useState<Format>('csv');
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState<ExportResult | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    window.electronAPI.exportAPI.getAdapters()
      .then(setAdapters)
      .catch(() => setAdapters([]));
  }, []);

  const handleExport = async () => {
    setLoading(true); setResult(null); setError(null);
    try {
      const opts: Record<string, unknown> = { format };
      if (adapterId) opts.adapterId = adapterId;
      if (fromDate)  opts.fromTs = new Date(fromDate).getTime();
      if (toDate)    opts.toTs   = new Date(toDate + 'T23:59:59').getTime();
      const res = await window.electronAPI.exportAPI.run(opts);
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.panel}>
      <div style={styles.heading}>Export Metrics</div>

      <div style={styles.field}>
        <label style={styles.label}>Adapter</label>
        <select style={styles.select} value={adapterId} onChange={e => setAdapterId(e.target.value)}>
          <option value=''>All adapters</option>
          {adapters.map(a => (
            <option key={a.adapterId} value={a.adapterId}>{a.adapterName}</option>
          ))}
        </select>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>From date</label>
        <input type='date' style={styles.input} value={fromDate} onChange={e => setFromDate(e.target.value)} />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>To date</label>
        <input type='date' style={styles.input} value={toDate} onChange={e => setToDate(e.target.value)} />
      </div>

      <label style={styles.label}>Format</label>
      <div style={styles.fmtRow}>
        <button style={styles.fmtBtn(format === 'csv')}  onClick={() => setFormat('csv')}>CSV</button>
        <button style={styles.fmtBtn(format === 'json')} onClick={() => setFormat('json')}>JSON</button>
      </div>

      <button
        style={{ ...styles.exportBtn, opacity: loading ? 0.6 : 1 }}
        onClick={handleExport}
        disabled={loading}
      >
        {loading ? 'Exporting…' : '⬇ Export'}
      </button>

      {result && (
        <div style={styles.success}>
          ✅ Exported {result.rowCount.toLocaleString()} rows<br />
          <strong>{result.filePath}</strong>
        </div>
      )}
      {error && <div style={styles.error}>⚠️ {error}</div>}
    </div>
  );
};

export default ExportPanel;
