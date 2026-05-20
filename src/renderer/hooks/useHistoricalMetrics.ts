import { useState, useEffect, useCallback, useRef } from 'react';
import { NetworkMetric, AggregatedMetric } from '../../shared/types';
import { ChartDataPoint } from '../components/SpeedChart';
import { TimeRange } from '../components/ChartControls';

const RANGE_MS: Record<TimeRange, number> = {
  '1h':  1  * 60 * 60 * 1000,
  '6h':  6  * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d':  7  * 24 * 60 * 60 * 1000,
};

// Use raw (1s) metrics for <=24h; aggregated (2h buckets) for 7d
const USE_AGGREGATED: Record<TimeRange, boolean> = {
  '1h':  false,
  '6h':  false,
  '24h': false,
  '7d':  true,
};

interface UseHistoricalMetricsResult {
  chartData: ChartDataPoint[];
  loading:   boolean;
  error:     string | null;
  refresh:   () => void;
}

function rawToChartPoints(metrics: NetworkMetric[]): ChartDataPoint[] {
  // Sort ascending by time for the chart
  return [...metrics]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((m) => ({
      timestamp: m.timestamp,
      speedUp:   m.speedUp,
      speedDown: m.speedDown,
    }));
}

function aggToChartPoints(metrics: AggregatedMetric[]): ChartDataPoint[] {
  return [...metrics]
    .sort((a, b) => a.intervalStart - b.intervalStart)
    .map((m) => ({
      timestamp: m.intervalStart,
      speedUp:   m.avgSpeedUp,
      speedDown: m.avgSpeedDown,
    }));
}

export function useHistoricalMetrics(
  timeRange:     TimeRange,
  adapterName:   string,
): UseHistoricalMetricsResult {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now   = Date.now();
      const since = now - RANGE_MS[timeRange];

      if (USE_AGGREGATED[timeRange]) {
        // 7d ÷ 2h buckets = 84 max rows; pass limit to satisfy AggregatedQuery and select array overload
        const agg = await window.electronAPI.getAggregated({
          adapterName: adapterName || undefined,
          since,
          until: now,
          limit: 84,
        });
        setChartData(aggToChartPoints(agg));
      } else {
        // For short ranges, cap at 3600 points (1 point/s for 1h)
        const raw = await window.electronAPI.getMetrics({
          adapterName: adapterName || undefined,
          since,
          until: now,
          limit: 21_600, // max 6h at 1s = 21,600 rows
        });
        setChartData(rawToChartPoints(raw));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chart data');
    } finally {
      setLoading(false);
    }
  }, [timeRange, adapterName]);

  useEffect(() => {
    fetch();
    // Refresh every 30s to pick up new data without spamming IPC
    timerRef.current = setInterval(fetch, 30_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetch]);

  return { chartData, loading, error, refresh: fetch };
}
