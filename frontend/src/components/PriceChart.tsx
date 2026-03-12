"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
} from "lightweight-charts";

const INDEXER_URL =
  process.env.NEXT_PUBLIC_INDEXER_URL || "http://localhost:3001";

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1D"] as const;
type Interval = (typeof INTERVALS)[number];

const LOOKBACK_MS: Record<Interval, number> = {
  "1m": 24 * 60 * 60 * 1000,
  "5m": 2 * 24 * 60 * 60 * 1000,
  "15m": 4 * 24 * 60 * 60 * 1000,
  "1h": 7 * 24 * 60 * 60 * 1000,
  "4h": 30 * 24 * 60 * 60 * 1000,
  "1D": 180 * 24 * 60 * 60 * 1000,
};

interface CandleRaw {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PriceChartProps {
  poolAddress: string;
  height?: number;
}

export default function PriceChart({
  poolAddress,
  height = 400,
}: PriceChartProps) {
  const [selectedInterval, setSelectedInterval] = useState<Interval>("1h");
  const [loading, setLoading] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  // Fetch candles
  const fetchCandles = useCallback(async (): Promise<CandleRaw[]> => {
    const now = Date.now();
    const from = Math.floor((now - LOOKBACK_MS[selectedInterval]) / 1000);
    const to = Math.floor(now / 1000);
    const apiInterval = selectedInterval === "1D" ? "1d" : selectedInterval;
    const url = `${INDEXER_URL}/api/candles?pool=${poolAddress}&interval=${apiInterval}&from=${from}&to=${to}`;

    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || json || [];
    } catch {
      return [];
    }
  }, [poolAddress, selectedInterval]);

  // Create chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { color: "#0a0a1a" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "#1a1a2e" },
        horzLines: { color: "#1a1a2e" },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: "#4b5563" },
        horzLine: { color: "#4b5563" },
      },
      timeScale: {
        borderColor: "#1a1a2e",
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: "#1a1a2e",
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        chart.applyOptions({ width });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [height]);

  // Load & refresh data
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      const candles = await fetchCandles();
      if (cancelled) return;

      if (candleSeriesRef.current && volumeSeriesRef.current) {
        const candleData: CandlestickData[] = candles.map((c) => ({
          time: c.time as CandlestickData["time"],
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));

        const volumeData: HistogramData[] = candles.map((c) => ({
          time: c.time as HistogramData["time"],
          value: c.volume,
          color:
            c.close >= c.open
              ? "rgba(34, 197, 94, 0.3)"
              : "rgba(239, 68, 68, 0.3)",
        }));

        candleSeriesRef.current.setData(candleData);
        volumeSeriesRef.current.setData(volumeData);
        chartRef.current?.timeScale().fitContent();
      }
      setLoading(false);
    };

    loadData();

    const interval = setInterval(loadData, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchCandles]);

  return (
    <div className="bg-dark-900 border border-dark-700 rounded-2xl overflow-hidden">
      {/* Interval selector */}
      <div className="flex items-center gap-1 p-3 border-b border-dark-700">
        {INTERVALS.map((iv) => (
          <button
            key={iv}
            onClick={() => setSelectedInterval(iv)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedInterval === iv
                ? "bg-primary-600 text-white"
                : "text-dark-400 hover:text-white hover:bg-dark-800"
            }`}
          >
            {iv}
          </button>
        ))}
      </div>

      {/* Chart container */}
      <div className="relative" style={{ height }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-dark-900/80">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-dark-400">Loading chart...</span>
            </div>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
