# Developer Setup Guide

This document explains how to get the project running locally from scratch.

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | https://nodejs.org |
| npm | 9+ | Comes with Node.js |
| Git | Latest | https://git-scm.com |

## 1. Clone & Install

```bash
git clone https://github.com/bishumoharana/Winning_NetworkthTracker.git
cd Winning_NetworkthTracker
npm install
```

> **Note**: Use `npm install`, not `npm ci` — the lockfile is not committed yet and will be generated on your first install.

## 2. Run Tests

```bash
npm test
```

Expected output: Jest runs the smoke tests in `src/main/__tests__/main.test.ts`. All 5 tests should pass.

## 3. Build the App

```bash
# Compile both main + renderer bundles
npm run build
```

This produces:
```
build/
  main/
    main.js        <- Electron main process bundle
  renderer/
    renderer.js    <- React renderer bundle
    index.html     <- HTML entry point
```

## 4. Start in Development Mode

```bash
npm run dev
```

This runs:
- `webpack --watch` for main process (recompiles on change)
- `webpack --watch` for renderer (recompiles on change)
- Waits for `build/renderer/index.html` to exist, then launches Electron

## 5. Start Electron Directly (after a build)

```bash
npm start
```

## Project Structure

```
src/
  main/           # Electron main process (Node.js)
    main.ts       # Entry: BrowserWindow, IPC handlers
    preload.ts    # contextBridge — exposes window.electronAPI
    __tests__/    # Unit tests for main process logic
  renderer/       # React frontend (Chromium)
    index.tsx     # React entry point
    App.tsx       # Root component
    App.css       # Global styles + CSS variable theming
    global.d.ts   # window.electronAPI TypeScript declarations
  shared/         # Types shared across main + renderer
    types.ts      # NetworkAdapter, NetworkMetric, AppSettings, IPC_CHANNELS
  __mocks__/      # Jest mocks (Electron, CSS)
build/            # Compiled output (git-ignored)
dist/             # Electron-builder installer output (git-ignored)
```

## Known Issues / Next Steps

- `package-lock.json` is not committed yet. Run `npm install` to generate it locally.
  Once the team confirms deps are stable, we will commit the lockfile and switch CI to `npm ci`.
- Issue #13 (Network Adapter Detection) is the next task to implement.

## CI / CD

Every push to `main` triggers the GitHub Actions pipeline (`.github/workflows/ci.yml`):
1. **Lint** — ESLint on all `.ts`/`.tsx` files
2. **Test** — Jest with 80%+ coverage requirement
3. **Build** — Webpack bundles on Windows (main platform target)
