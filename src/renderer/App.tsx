import React, { useEffect, useState, useCallback } from 'react';
import { NetworkAdapter, NetworkMetric } from '../shared/types';
import { formatSpeed } from '../main/network/trafficCapture';

type Theme = 'dark' | 'light';

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

const App: React.FC = () => {
  const [theme, setTheme]     = useState<Theme>('dark');
  const [adapters, setAdapters] = useState<NetworkAdapter[]>([]);
  const [metrics, setMetrics]   = useState<Map<string, NetworkMetric>>(new Map());
  const [loading, setLoading]   = useState(true);

  // One-time init
  useEffect(() => {
    window.electronAPI?.getTheme().then((t) => setTheme(t as Theme));
    window.electronAPI?.getAdapters().then((a) => {
      setAdapters(a);
      setLoading(false);
    });

    // Subscribe to live metrics pushed from TrafficPoller every 1s
    window.electronAPI?.onNetworkMetric((incoming: NetworkMetric[]) => {
      setMetrics((prev) => {
        const next = new Map(prev);
        for (const m of incoming) next.set(m.adapterId, m);
        return next;
      });
    });

    // Subscribe to adapter state changes from NetworkMonitor
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
        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
      </header>

      <main className="app-main">
        <section className="adapters-panel">
          <h2 className="section-title">Network Adapters</h2>

          {loading && <p className="status-msg">Detecting adapters…</p>}

          {!loading && adapters.length === 0 && (
            <p className="status-msg">No physical adapters found.</p>
          )}

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
            <strong>Sprint 2 ✔</strong> — Live traffic capture active.
            Next: Task 2.2 — SQLite persistence layer.
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
