import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export interface ChartDataPoint {
  timestamp: number;
  speedUp:   number;
  speedDown: number;
}

interface SpeedChartProps {
  data:        ChartDataPoint[];
  adapterName: string;
  rangeLabel:  string;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatSpeedAxis(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)}M`;
  if (bytes >= 1_000)     return `${(bytes / 1_000).toFixed(0)}K`;
  return `${bytes.toFixed(0)}`;
}

function formatSpeedFull(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB/s`;
  if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(2)} MB/s`;
  if (bytes >= 1_024)         return `${(bytes / 1_024).toFixed(2)} KB/s`;
  return `${bytes.toFixed(0)} B/s`;
}

const CustomTooltip: React.FC<{
  active?:  boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?:   number;
}> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-time">{label ? formatTime(label) : ''}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === 'speedUp' ? '↑ Upload' : '↓ Download'}: {formatSpeedFull(p.value)}
        </p>
      ))}
    </div>
  );
};

const SpeedChart: React.FC<SpeedChartProps> = ({ data, adapterName, rangeLabel }) => {
  if (data.length === 0) {
    return (
      <div className="chart-empty">
        <span className="chart-empty-icon">📊</span>
        <p>No historical data yet for <strong>{adapterName}</strong>.</p>
        <p className="chart-empty-sub">Data will appear once the aggregation cycle has run.</p>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <span className="chart-adapter-label">{adapterName}</span>
        <span className="chart-range-label">{rangeLabel}</span>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatTime}
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            scale="time"
          />
          <YAxis
            tickFormatter={formatSpeedAxis}
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(val) => val === 'speedUp' ? '↑ Upload' : '↓ Download'}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
          <Line
            type="monotone"
            dataKey="speedUp"
            stroke="var(--speed-up)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="speedDown"
            stroke="var(--speed-down)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SpeedChart;
