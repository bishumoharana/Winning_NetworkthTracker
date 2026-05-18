import React, { useEffect, useState, useCallback } from 'react';
import { NetworkAdapter } from '../shared/types';
import { NetworkChangeEvent } from '../main/network/networkMonitor';

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

const eventTypeLabel: Record<NetworkChangeEvent['type'], string> = {
  'adapter-added':    '➕ Added',
  'adapter-removed':  '➖ Removed',
  'status-changed':   '🔄 Status',
  'primary-changed':  '⭐ Primary',
};

const MAX_EVENTS = 20;

const App: React.FC = () => {
  const [theme, setTheme]     = useState<Theme>('dark');
  const [adapters, setAdapters] = useState<NetworkAdapter[]>([]);
  const [eventLog, setEventLog] = useState<Array<NetworkChangeEvent & { ts: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [monitorRunning, setMonitorRunning] = useState(false);

  // Initial load
  useEffect(() => {
    window.electronAPI?.getTheme().then((t) => setTheme(t as Theme));
    window.electronAPI?.getAdapters().then((a) => {
      setAdapters(a);
      setLoading(false);
    });
    window.electronAPI?.getMonitorStatus().then((s) => {
      setMonitorRunning(s.isRunning);
    });
  }, []);

  // Subscribe to real-time network change events
  const handleNetworkChange = useCallback((events: NetworkChangeEvent[]) => {
    // Update adapter list on any change event
    window.electronAPI?.getAdapters().then(setAdapters);

    // Append events to log (keep last MAX_EVENTS)
    setEventLog((prev) => [
      ...events.map((e) => ({ ...e, ts: Date.now() })),
      ...prev,
    ].slice(0, MAX_EVENTS));
  }, []);

  useEffect(() => {
    window.electronAPI?.onNetworkChange(handleNetworkChange);
    return () => {
      window.electronAPI?.removeNetworkListeners();
    };
  }, [handleNetworkChange]);

  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    await window.electronAPI?.setTheme(next);
    setTheme(next);
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className={`app-root ${theme}`}>
      <header className="app-header">
        <h1 className="app-title">🌐 Network Tracker</h1>
        <div className="header-right">
          <span className={`monitor-badge ${monitorRunning ? 'running' : 'stopped'}`}>
            {monitorRunning ? '● LIVE' : '○ PAUSED'}
          </span>
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </header>

      <main className="app-main">
        {/* ── Adapters Section ── */}
        <section className="panel">
          <h2 className="section-title">Network Adapters</h2>
          {loading && <p className="status-msg">Detecting adapters…</p>}
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
                    <span className="adapter-status-badge" style={{ color: statusColor[adapter.status] }}>
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
        </section>

        {/* ── Live Event Log Section ── */}
        <section className="panel">
          <h2 className="section-title">Live Event Log</h2>
          {eventLog.length === 0 ? (
            <p className="status-msg">Monitoring… events will appear here when network changes are detected.</p>
          ) : (
            <ul className="event-list">
              {eventLog.map((ev, idx) => (
                <li key={idx} className={`event-item event-${ev.type}`}>
                  <span className="event-time">{formatTime(ev.ts)}</span>
                  <span className="event-type-label">{eventTypeLabel[ev.type]}</span>
                  <span className="event-adapter">{ev.adapter.name}</span>
                  {ev.previousStatus && (
                    <span className="event-detail">
                      {ev.previousStatus} → {ev.adapter.status}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="sprint-note">
          <strong>Sprint 1 ✔ Complete</strong> — Adapter detection + real-time state monitoring live.
          Next: Sprint 2 — Task 2.1 Network traffic capture.
        </div>
      </main>
    </div>
  );
};

export default App;
