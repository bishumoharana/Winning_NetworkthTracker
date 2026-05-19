import React, { useEffect, useState, useCallback } from 'react';

type Period = 'day' | 'week' | 'month';

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

function fmtBytes(b: number): string {
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(2)} GB`;
  if (b >= 1_048_576)     return `${(b / 1_048_576).toFixed(2)} MB`;
  if (b >= 1_024)         return `${(b / 1_024).toFixed(1)} KB`;
  return `${b} B`;
}

function fmtSpeed(bps: number): string {
  if (bps >= 1_073_741_824) return `${(bps / 1_073_741_824).toFixed(1)} GB/s`;
  if (bps >= 1_048_576)     return `${(bps / 1_048_576).toFixed(1)} MB/s`;
  if (bps >= 1_024)         return `${(bps / 1_024).toFixed(0)} KB/s`;
  return `${bps} B/s`;
}

const PERIODS: { key: Period; label: string }[] = [
  { key: 'day',   label: 'Today' },
  { key: 'week',  label: 'This Week' },
  { key: 'month', label: 'This Month' },
];

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '7px 16px', borderRadius: '6px', border: '1px solid',
    borderColor: active ? '#38bdf8' : '#334155',
    background:  active ? '#0c4a6e' : '#1e293b',
    color:       active ? '#f0f9ff' : '#94a3b8',
    fontWeight:  active ? 700 : 400,
    cursor: 'pointer', fontSize: '0.88rem',
  };
}

const c: Record<string, React.CSSProperties> = {
  panel:      { padding: '28px 32px', fontFamily: 'system-ui, sans-serif', color: '#e2e8f0', minWidth: 0 },
  heading:    { fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '20px' },
  toolbar:    { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' },
  tabRow:     { display: 'flex', gap: '6px' },
  select:     { padding: '7px 12px', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', fontSize: '0.88rem' },
  summaryBar: { display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' },
  kpi:        { background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '12px 18px', minWidth: '130px' },
  kpiVal:     { fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' },
  kpiLbl:     { fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' },
  tableWrap:  { overflowX: 'auto' },
  table:      { width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' },
  th:         { padding: '10px 14px', textAlign: 'left', borderBottom: '1px solid #334155', color: '#64748b', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' },
  td:         { padding: '10px 14px', borderBottom: '1px solid #1e293b', color: '#e2e8f0', whiteSpace: 'nowrap' },
  empty:      { textAlign: 'center', padding: '48px 24px', color: '#475569' },
  emptyIcon:  { fontSize: '2.5rem', marginBottom: '10px' },
};

export const HistoryPanel: React.FC = () => {
  const [period,    setPeriod]    = useState<Period>('day');
  const [adapterId, setAdapterId] = useState<string>('');
  const [adapters,  setAdapters]  = useState<{ adapterId: string; adapterName: string }[]>([]);
  const [rows,      setRows]      = useState<StatsRow[]>([]);
  const [summary,   setSummary]   = useState<SummaryRow | null>(null);
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    window.electronAPI.exportAPI.getAdapters()
      .then(setAdapters).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        window.electronAPI.statsAPI.get(period, adapterId || undefined),
        window.electronAPI.statsAPI.getSummary(period),
      ]);
      setRows(r);
      setSummary(s);
    } catch { setRows([]); setSummary(null); }
    finally { setLoading(false); }
  }, [period, adapterId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={c.panel}>
      <div style={c.heading}>Bandwidth History</div>

      <div style={c.toolbar}>
        <div style={c.tabRow}>
          {PERIODS.map(p => (
            <button key={p.key} style={tabStyle(period === p.key)} onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
        <select style={c.select} value={adapterId} onChange={e => setAdapterId(e.target.value)}>
          <option value=''>All adapters</option>
          {adapters.map(a => (
            <option key={a.adapterId} value={a.adapterId}>{a.adapterName}</option>
          ))}
        </select>
      </div>

      {summary && summary.sampleCount > 0 && (
        <div style={c.summaryBar}>
          <div style={c.kpi}><div style={c.kpiVal}>{fmtBytes(summary.totalBytesReceived)}</div><div style={c.kpiLbl}>Total Downloaded</div></div>
          <div style={c.kpi}><div style={c.kpiVal}>{fmtBytes(summary.totalBytesSent)}</div><div style={c.kpiLbl}>Total Uploaded</div></div>
          <div style={c.kpi}><div style={c.kpiVal}>{fmtSpeed(summary.peakSpeedDown)}</div><div style={c.kpiLbl}>Peak Download</div></div>
          <div style={c.kpi}><div style={c.kpiVal}>{fmtSpeed(summary.peakSpeedUp)}</div><div style={c.kpiLbl}>Peak Upload</div></div>
          <div style={c.kpi}><div style={c.kpiVal}>{summary.sampleCount.toLocaleString()}</div><div style={c.kpiLbl}>Samples</div></div>
        </div>
      )}

      {loading ? (
        <div style={c.empty}><div>Loading…</div></div>
      ) : rows.length === 0 ? (
        <div style={c.empty}>
          <div style={c.emptyIcon}>📊</div>
          <div>No data for this period yet.</div>
          <div style={{ fontSize: '0.82rem', marginTop: '6px' }}>Data appears here once the monitor has been running.</div>
        </div>
      ) : (
        <div style={c.tableWrap}>
          <table style={c.table}>
            <thead>
              <tr>
                {['Adapter','Total ↓','Total ↑','Peak ↓','Peak ↑','Avg ↓','Avg ↑','Samples']
                  .map(h => <th key={h} style={c.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.adapterId}
                  onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ ...c.td, fontWeight: 600, color: '#f1f5f9' }}>{r.adapterName}</td>
                  <td style={c.td}>{fmtBytes(r.totalBytesReceived)}</td>
                  <td style={c.td}>{fmtBytes(r.totalBytesSent)}</td>
                  <td style={c.td}>{fmtSpeed(r.peakSpeedDown)}</td>
                  <td style={c.td}>{fmtSpeed(r.peakSpeedUp)}</td>
                  <td style={c.td}>{fmtSpeed(r.avgSpeedDown)}</td>
                  <td style={c.td}>{fmtSpeed(r.avgSpeedUp)}</td>
                  <td style={{ ...c.td, color: '#64748b' }}>{r.sampleCount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
