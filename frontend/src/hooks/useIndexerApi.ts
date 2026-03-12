"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const INDEXER_URL =
  process.env.NEXT_PUBLIC_INDEXER_URL || "http://localhost:3001";

// --- Interfaces ---

export interface PoolStats {
  pool_address: string;
  token_a_mint: string;
  token_b_mint: string;
  token_a_symbol: string;
  token_b_symbol: string;
  reserve_a: number;
  reserve_b: number;
  total_lp_supply: number;
  fee_rate: number;
  volume_24h: number;
  volume_7d: number;
  fees_24h: number;
  total_fees: number;
  trade_count: number;
  price_change_24h: number;
  tvl: number;
  price: number;
}

export interface ProtocolStats {
  total_pools: number;
  total_24h_volume: number;
  total_tvl: number;
  total_24h_fees: number;
  total_swaps: number;
}

export interface SwapRecord {
  id: number;
  pool_address: string;
  user_address: string;
  swap_direction: number; // 0 = A→B, 1 = B→A
  amount_in: string;
  amount_out: string;
  fee_amount: string;
  price: number;
  signature: string;
  block_time: string;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// --- Generic fetcher ---

function useAutoFetch<T>(
  url: string | null,
  refreshInterval: number
): FetchState<T> & { refresh: () => void } {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!url) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // API wraps responses in { data: ... }, unwrap if present
      const result = json.data !== undefined ? json.data : json;
      setState({ data: result, loading: false, error: null });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Fetch failed",
      }));
    }
  }, [url]);

  useEffect(() => {
    fetchData();
    if (!url) return;

    const interval = setInterval(fetchData, refreshInterval);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [fetchData, refreshInterval, url]);

  return { ...state, refresh: fetchData };
}

// --- Hooks ---

export function usePoolStats(poolAddress?: string) {
  const url = poolAddress
    ? `${INDEXER_URL}/api/pools/${poolAddress}/stats`
    : `${INDEXER_URL}/api/pools/stats`;
  return useAutoFetch<PoolStats>(url, 30_000);
}

export function useProtocolStats() {
  return useAutoFetch<ProtocolStats>(
    `${INDEXER_URL}/api/protocol/stats`,
    30_000
  );
}

export function useSwaps(poolAddress: string, limit: number = 50) {
  const url = poolAddress
    ? `${INDEXER_URL}/api/swaps?pool=${poolAddress}&limit=${limit}`
    : null;
  return useAutoFetch<SwapRecord[]>(url, 15_000);
}

export function useUserSwaps(walletAddress: string | null) {
  const url = walletAddress
    ? `${INDEXER_URL}/api/swaps/user?address=${walletAddress}`
    : null;
  return useAutoFetch<SwapRecord[]>(url, 15_000);
}

export function useCandles(poolAddress: string, interval: string) {
  const lookbackMs: Record<string, number> = {
    "1m": 24 * 60 * 60 * 1000, // 1 day
    "5m": 2 * 24 * 60 * 60 * 1000, // 2 days
    "15m": 4 * 24 * 60 * 60 * 1000, // 4 days
    "1h": 7 * 24 * 60 * 60 * 1000, // 7 days
    "4h": 30 * 24 * 60 * 60 * 1000, // 30 days
    "1D": 180 * 24 * 60 * 60 * 1000, // 180 days
  };

  const now = Date.now();
  const from = Math.floor(
    (now - (lookbackMs[interval] || lookbackMs["1h"])) / 1000
  );
  const to = Math.floor(now / 1000);

  const apiInterval = interval === "1D" ? "1d" : interval;
  const url = poolAddress
    ? `${INDEXER_URL}/api/candles?pool=${poolAddress}&interval=${apiInterval}&from=${from}&to=${to}`
    : null;
  return useAutoFetch<CandleData[]>(url, 10_000);
}
