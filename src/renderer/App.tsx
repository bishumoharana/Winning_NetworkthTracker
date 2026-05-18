import React, { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

const App: React.FC = () => {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    // Fetch initial theme from main process
    window.electronAPI?.getTheme().then((t: string) => {
      setTheme(t as Theme);
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
        <section className="placeholder-panel">
          <h2>Sprint 1 — Environment Ready ✅</h2>
          <p>Electron + React + TypeScript scaffold is running.</p>
          <p>Next: Task 1.2 — Network adapter detection.</p>
        </section>
      </main>
    </div>
  );
};

export default App;
