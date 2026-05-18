import React, { useEffect, useState, useCallback } from 'react';
import { NetworkAdapter, NetworkMetric } from '../shared/types';
import { formatSpeed } from '../main/network/trafficCapture';
import SpeedChart from './components/SpeedChart';
import ChartControls, { TimeRange } from './components/ChartControls';
import AlertsSettings from './components/AlertsSettings';
import { useHistoricalMetrics } from './hooks/useHistoricalMetrics';

type Theme = 'dark' | 'light';
type Tab   = 'dashboard' | 'charts' | 'alerts';

const adapterTypeIcon: Record<NetworkAdapter['type'], string> = {
  ethernet: '🔌',
  wifi:     '📶',
  cellular: '📡',
  unknown:  '❓',
};

const statusColor: Record<NetworkAdapter['status'], string> = {
  active:   'var(--success)',
  standby:  'var(--warning)',
  inactive: 'var(--text-secondary)',
};

// ─── Charts Tab ──────────────────────────────────────────────────────────────
const ChartsTab: React.FC<{ adapters: NetworkAdapter[] }> = ({ adapters }) => {
  const [timeRange,     setTimeRange]     = useState<TimeRange>('1h');
  const [activeAdapter, setActiveAdapter] = useState<string>('');
  const adapterNames = adapters.map((a) => a.name);
  const { chartData, loading, error, refresh } = useHistoricalMetrics(timeRange, activeAdapter);
  const rangeLabels: Record<TimeRange, string> = {
    '1h': 'Last 1 Hour', '6h': 'Last 6 Hours',
    '24h': 'Last 24 Hours', '7d': 'Last 7 Days',
  };
  return (
    <section className="charts-panel">
      <div className="charts-header">
        <h2 className="section-title">Speed History</h2>
        <button className="refresh-btn" onClick={refresh}>↻ Refresh</button>
      </div>
      <ChartControls
        timeRange={timeRange} onTimeRange={setTimeRange}
        adapters={adapterNames} activeAdapter={activeAdapter} onAdapter={setActiveAdapter}
      />
      <div className="chart-wrapper">
        {loading && <div className="chart-loading"><div className="chart-spinner" /><p>Loading…</p></div>}
        {!loading && error && <div className="chart-error"><span>⚠️ {error}</span><button onClick={refresh}>Retry</button></div>}
        {!loading && !error && <SpeedChart data={chartData} adapterName={activeAdapter || 'All Adapters'} rangeLabel={rangeLabels[timeRange]} />}
      </div>
    </section>
  );
};

// ─── Root App ────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const [theme,    setTheme]    = useState<Theme>('dark');
  const [tab,      setTab]      = useState<Tab>('dashboard');
  const [adapters, setAdapters] = useState<NetworkAdapter[]>([]);
  const [metrics,  setMetrics]  = useState<Map<string, NetworkMetric>>(new Map());
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    window.electronAPI?.getTheme().then((t) => setTheme(t as Theme));
    window.electronAPI?.getAdapters().then((a) => { setAdapters(a); setLoading(false); });
    window.electronAPI?.onNetworkMetric((incoming: NetworkMetric[]) => {
      setMetrics((prev) => {
        const next = new Map(prev);
        for (const m of incoming) next.set(m.adapterId, m);
        return next;
      });
    });
    window.electronAPI?.onNetworkChange(() => {
      window.electronAPI?.getAdapters().then(setAdapters);
    });
    return () => {
      window.electronAPI?.removeNetworkListeners();
      window.electronAPI?.removeMetricListeners();
    };
  }, []);

  const toggleTheme = useCallback(async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    await window.electronAPI?.setTheme(next);
    setTheme(next);
  }, [theme]);

  return (
    <div className={`app-root ${theme}`}>
      <header className="app-header">
        <h1 className="app-title">🌐 Network Tracker</h1>
        <nav className="tab-nav">
          <button className={`tab-btn ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>Dashboard</button>
          <button className={`tab-btn ${tab === 'charts'    ? 'active' : ''}`} onClick={() => setTab('charts')}>📈 Charts</button>
          <button className={`tab-btn ${tab === 'alerts'    ? 'active' : ''}`} onClick={() => setTab('alerts')}>🔔 Alerts</button>
        </nav>
        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
      </header>

      <main className="app-main">
        {tab === 'dashboard' && (
          <section className="adapters-panel">
            <h2 className="section-title">Network Adapters</h2>
            {loading && <p className="status-msg">Detecting adapters…</p>}
            {!loading && adapters.length === 0 && <p className="status-msg">No physical adapters found.</p>}
            {!loading && adapters.length > 0 && (
              <ul className="adapter-list">
                {adapters.map((adapter) => {
                  const m = metrics.get(adapter.name);
                  return (
                    <li key={adapter.mac || adapter.name} className="adapter-card">
                      <div className="adapter-header">
                        <span className="adapter-icon">{adapterTypeIcon[adapter.type]}</span>
                        <span className="adapter-name">{adapter.name}</span>
                        <span className="adapter-status-badge" style={{ color: statusColor[adapter.status] }}>
                          ● {adapter.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="adapter-meta">
                        <span>Type: <strong>{adapter.type}</strong></span>
                        <span>MAC: <code>{adapter.mac || 'n/a'}</code></span>
                        {adapter.ipv4 && <span>IPv4: <code>{adapter.ipv4}</code></span>}
                      </div>
                      {m && (
                        <div className="adapter-speeds">
                          <span className="speed-up">↑ {formatSpeed(m.speedUp)}</span>
                          <span className="speed-down">↓ {formatSpeed(m.speedDown)}</span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="sprint-note">
              <strong>Sprint 2 ✔</strong> — Live capture, SQLite, aggregation, charts, alerts all complete.
            </div>
          </section>
        )}
        {tab === 'charts' && <ChartsTab adapters={adapters} />}
        {tab === 'alerts' && <AlertsSettings />}
      </main>
    </div>
  );
};

export default App;
