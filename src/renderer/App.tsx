import React, { useEffect, useState } from 'react';
import { NetworkAdapter } from '../shared/types';

type Theme = 'dark' | 'light';

const adapterTypeIcon: Record<NetworkAdapter['type'], string> = {
  ethernet: '🔌',
  wifi: '📶',
  cellular: '📡',
  unknown: '❓',
};

const statusColor: Record<NetworkAdapter['status'], string> = {
  active: 'var(--success)',
  standby: 'var(--warning)',
  inactive: 'var(--text-secondary)',
};

const App: React.FC = () => {
  const [theme, setTheme] = useState<Theme>('dark');
  const [adapters, setAdapters] = useState<NetworkAdapter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.electronAPI?.getTheme().then((t: string) => setTheme(t as Theme));
    window.electronAPI?.getAdapters().then((a: NetworkAdapter[]) => {
      setAdapters(a);
      setLoading(false);
    });
  }, []);

  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    await window.electronAPI?.setTheme(next);
    setTheme(next);
  };

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

          {loading && (
            <p className="status-msg">Detecting adapters…</p>
          )}

          {!loading && adapters.length === 0 && (
            <p className="status-msg">No physical adapters found.</p>
          )}

          {!loading && adapters.length > 0 && (
            <ul className="adapter-list">
              {adapters.map((adapter) => (
                <li key={adapter.mac || adapter.name} className="adapter-card">
                  <div className="adapter-header">
                    <span className="adapter-icon">{adapterTypeIcon[adapter.type]}</span>
                    <span className="adapter-name">{adapter.name}</span>
                    <span
                      className="adapter-status-badge"
                      style={{ color: statusColor[adapter.status] }}
                    >
                      ● {adapter.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="adapter-meta">
                    <span>Type: <strong>{adapter.type}</strong></span>
                    <span>MAC: <code>{adapter.mac || 'n/a'}</code></span>
                    {adapter.ipv4 && <span>IPv4: <code>{adapter.ipv4}</code></span>}
                    {adapter.ipv6 && <span>IPv6: <code>{adapter.ipv6}</code></span>}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="sprint-note">
            <strong>Sprint 1 ✔</strong> — Adapter detection live.
            Next: Task 1.3 — Real-time state monitoring.
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
