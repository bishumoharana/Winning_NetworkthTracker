import React from 'react';

export type TimeRange = '1h' | '6h' | '24h' | '7d';

interface ChartControlsProps {
  timeRange:      TimeRange;
  onTimeRange:    (r: TimeRange) => void;
  adapters:       string[];
  activeAdapter:  string;
  onAdapter:      (a: string) => void;
}

const RANGES: { value: TimeRange; label: string }[] = [
  { value: '1h',  label: '1 Hour'  },
  { value: '6h',  label: '6 Hours' },
  { value: '24h', label: '24 Hours'},
  { value: '7d',  label: '7 Days'  },
];

const ChartControls: React.FC<ChartControlsProps> = ({
  timeRange, onTimeRange, adapters, activeAdapter, onAdapter,
}) => (
  <div className="chart-controls">
    <div className="range-tabs">
      {RANGES.map((r) => (
        <button
          key={r.value}
          className={`range-tab-btn ${timeRange === r.value ? 'active' : ''}`}
          onClick={() => onTimeRange(r.value)}
        >
          {r.label}
        </button>
      ))}
    </div>

    {adapters.length > 1 && (
      <select
        className="adapter-select"
        value={activeAdapter}
        onChange={(e) => onAdapter(e.target.value)}
      >
        <option value="">All Adapters</option>
        {adapters.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>
    )}
  </div>
);

export default ChartControls;
