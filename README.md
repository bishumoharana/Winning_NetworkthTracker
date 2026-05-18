# Network Tracker

> Real-time network traffic monitor built with Electron, React, TypeScript, and SQLite.

![CI](https://github.com/bishumoharana/Winning_NetworkthTracker/actions/workflows/ci.yml/badge.svg)

---

## Features

| Feature | Description |
|---|---|
| **Live Dashboard** | Per-adapter upload/download speeds updated every second |
| **Historical Charts** | Line charts of speed over time, filterable by adapter |
| **Alerts & Thresholds** | OS notifications when speed exceeds configurable limits |
| **System Tray** | Minimise to tray; live speed in tooltip; context menu |
| **Export** | Download metrics as `.csv` or `.json` with date/adapter filters |
| **History & Stats** | Daily/weekly/monthly totals, peaks, and averages per adapter |
| **Auto-launch** | Optional launch at login (Windows, macOS, Linux) |
| **Auto-update** | Background update checks via GitHub Releases |
| **Cross-platform** | Windows (NSIS), macOS (DMG), Linux (AppImage + deb) |

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20 LTS or later |
| npm | 10 or later (bundled with Node 20) |
| Git | Any recent version |

> **Windows only:** `better-sqlite3` requires native compilation. Install the [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the **Desktop development with C++** workload before running `npm install`.

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/bishumoharana/Winning_NetworkthTracker.git
cd Winning_NetworkthTracker

# 2. Install dependencies
npm install

# 3. Start in development mode (hot-reload renderer + Electron)
npm run dev
```

The app opens automatically. The renderer dev server runs on `http://localhost:3000`.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Electron + webpack dev server with hot reload |
| `npm test` | Run all Jest unit tests |
| `npm test -- --coverage` | Run tests with lcov coverage report |
| `npm run lint` | ESLint across `src/` |
| `npm run build:main` | Compile main process TypeScript → `build/main/` |
| `npm run build:renderer` | Bundle renderer with webpack → `build/renderer/` |
| `npm run build:all` | Both of the above in sequence |
| `npm run dist` | Full build + package for current platform |
| `npm run dist:win` | Package Windows NSIS installer |
| `npm run dist:mac` | Package macOS DMG + zip (x64 + arm64) |
| `npm run dist:linux` | Package Linux AppImage + deb |

---

## Project Structure

```
Winning_NetworkthTracker/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── alerts/              # Threshold alerting service
│   │   ├── db/                  # SQLite database, schema, repository
│   │   ├── export/              # CSV / JSON export service
│   │   ├── ipc/                 # IPC handler registration
│   │   ├── network/             # Adapter detection, traffic capture, poller
│   │   ├── startup/             # Auto-launch (login item) service
│   │   ├── stats/               # Bandwidth history aggregation
│   │   ├── tray/                # System tray manager
│   │   ├── updater/             # electron-updater wrapper
│   │   ├── __tests__/           # Unit tests for all main-process services
│   │   └── main.ts              # App entry point
│   ├── renderer/                # React renderer process
│   │   └── components/
│   │       ├── Dashboard.tsx    # Live speed dashboard
│   │       ├── ChartsPanel.tsx  # Historical charts
│   │       ├── AlertsSettings.tsx
│   │       ├── ExportPanel.tsx
│   │       ├── HistoryPanel.tsx
│   │       ├── SettingsPanel.tsx
│   │       └── UpdateBanner.tsx # Floating update notification
│   ├── shared/
│   │   └── types.ts             # Shared TypeScript types + IPC channel names
│   └── preload.ts               # Context bridge — exposes electronAPI to renderer
├── assets/
│   └── entitlements.mac.plist   # macOS hardened runtime entitlements
├── scripts/
│   └── notarize.js              # macOS notarization hook (no-op without secrets)
├── .github/
│   └── workflows/
│       ├── ci.yml               # Lint + test on push/PR (all 3 platforms)
│       └── build.yml            # Electron-builder packaging on tag push
├── electron-builder.yml         # Build/packaging configuration
├── tsconfig.json                # Shared TypeScript base config
├── tsconfig.main.json           # Main process tsconfig
├── webpack.renderer.config.js   # Renderer webpack config
└── jest.config.js               # Jest configuration
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Electron Main Process               │
│                                                     │
│  adapterDetector → trafficPoller (1s tick)          │
│         │                │                          │
│    metricsRepository  alertsService                 │
│    (SQLite)           (OS Notification)             │
│         │                                           │
│  IPC Handlers  ←──────────────────────────────┐    │
│  (networkHandlers, exportHandlers,             │    │
│   statsHandlers, startupHandlers,              │    │
│   updaterHandlers, alertsHandlers)             │    │
│         │                                      │    │
│  trayManager        updaterService             │    │
└──────────┼──────────────────────────────────────────┘
           │  contextBridge (preload.ts)
           │  window.electronAPI
┌──────────▼──────────────────────────────────────────┐
│              React Renderer Process                  │
│                                                     │
│  Dashboard  Charts  Alerts  Export  History         │
│  Settings   UpdateBanner                            │
└─────────────────────────────────────────────────────┘
```

**Key principles:**
- The main process owns all Node.js/OS APIs (SQLite, fs, notifications, tray)
- The renderer is sandboxed — it communicates only through the typed `electronAPI` context bridge
- All IPC channels are typed via `IPC_CHANNELS` in `src/shared/types.ts`

---

## Database

SQLite database is stored at Electron's `userData` path:

| Platform | Path |
|---|---|
| Windows | `%APPDATA%\network-tracker\network-tracker.db` |
| macOS | `~/Library/Application Support/network-tracker/network-tracker.db` |
| Linux | `~/.config/network-tracker/network-tracker.db` |

Two tables:
- `network_metrics` — raw 1-second samples (adapter, timestamp, bytes, speeds)
- `app_config` — key/value store for alerts config, startup setting, etc.

---

## CI / CD

### On every push to `main` or PR
```
ci.yml  →  lint + jest (Ubuntu, Windows, macOS)
           └── uploads coverage report (lcov) as artifact
```

### On tag push `v*.*.*`
```
build.yml  →  electron-builder (Windows NSIS, macOS DMG, Linux AppImage+deb)
              └── uploads dist/ as artifact per platform (retained 30 days)
```

### Cutting a release
```bash
git tag v1.0.0
git push origin v1.0.0
# GitHub Actions builds all 3 platforms automatically
# Artifacts are available in the Actions run
```

---

## Code Signing & Notarization (optional)

Set these as **GitHub Actions Secrets** in your repository settings:

| Secret | Platform | Description |
|---|---|---|
| `APPLE_ID` | macOS | Apple ID email for notarization |
| `APPLE_ID_PASSWORD` | macOS | App-specific password |
| `APPLE_TEAM_ID` | macOS | 10-character team ID |
| `CSC_LINK` | Windows | Base64-encoded `.p12` certificate |
| `CSC_KEY_PASSWORD` | Windows | Certificate password |

Without these secrets, builds succeed but are unsigned (fine for development/testing).

---

## Running Tests

```bash
# All tests
npm test

# Watch mode during development
npm test -- --watch

# With coverage report
npm test -- --coverage

# Single test file
npm test -- alertsService
```

Test files live alongside the code they test in `src/main/__tests__/`.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes with tests
4. Ensure all tests pass: `npm test`
5. Ensure lint passes: `npm run lint`
6. Open a pull request against `main`

---

## License

MIT — see [LICENSE](LICENSE) for details.
