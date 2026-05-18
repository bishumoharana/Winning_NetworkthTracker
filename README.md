# Winning Network Tracker

A cross-platform desktop application built with Electron + React + TypeScript to monitor network adapters, real-time data usage, and visualize usage trends.

## Features

- Real-time network adapter detection and monitoring
- Per-adapter upload/download speed tracking
- Historical data visualization (line graphs, bar charts)
- 2-hour interval data aggregation
- System tray / taskbar integration
- Customizable alerts and thresholds
- CSV data export
- Dark/Light theme

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Electron 28 |
| Frontend | React 18 + TypeScript |
| Charts | Recharts |
| Database | SQLite (better-sqlite3) |
| Build | Webpack + Electron Builder |
| Testing | Jest + React Testing Library |

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm 9+

### Installation
```bash
git clone https://github.com/bishumoharana/Winning_NetworkthTracker.git
cd Winning_NetworkthTracker
npm install
```

### Development
```bash
npm run dev
```

### Run Tests
```bash
npm test
```

### Build
```bash
npm run build
```

## Project Structure

```
src/
  main/          # Electron main process (Node.js)
  renderer/      # React frontend
  shared/        # Shared types and utilities
```

## Backlog & Roadmap

This project follows a structured 8-sprint backlog. See [Issues](https://github.com/bishumoharana/Winning_NetworkthTracker/issues) for detailed task tracking.

## License

MIT
