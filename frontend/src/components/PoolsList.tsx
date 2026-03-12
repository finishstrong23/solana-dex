"use client";

import Link from "next/link";
import { usePools } from "@/hooks/usePools";

export default function PoolsList() {
  const { pools, loading } = usePools();

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-pulse"
          >
            <div className="h-6 bg-dark-700 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-dark-700 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (pools.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">~</div>
        <h3 className="text-xl font-semibold mb-2">No Pools Yet</h3>
        <p className="text-dark-400">
          Create the first liquidity pool to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="grid grid-cols-5 gap-4 px-6 py-3 text-sm text-dark-400 font-medium">
        <span>Pool</span>
        <span className="text-right">TVL</span>
        <span className="text-right">24h Volume</span>
        <span className="text-right">Fee Rate</span>
        <span className="text-right">APR</span>
      </div>

      {/* Pool Rows */}
      {pools.map((pool) => (
        <Link
          key={pool.address}
          href={`/pools/${pool.address}`}
          className="pool-card block bg-dark-900 border border-dark-700 rounded-xl p-6 hover:border-primary-600/50"
        >
          <div className="grid grid-cols-5 gap-4 items-center">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-xs font-bold border-2 border-dark-900 z-10">
                  {pool.tokenASymbol[0]}
                </div>
                <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-xs font-bold border-2 border-dark-900">
                  {pool.tokenBSymbol[0]}
                </div>
              </div>
              <span className="font-semibold">
                {pool.tokenASymbol}/{pool.tokenBSymbol}
              </span>
            </div>
            <span className="text-right font-medium">
              ${pool.tvl.toLocaleString()}
            </span>
            <span className="text-right text-dark-300">
              ${pool.volume24h.toLocaleString()}
            </span>
            <span className="text-right text-dark-300">
              {(pool.feeRate / 100).toFixed(2)}%
            </span>
            <span className="text-right text-green-400 font-semibold">
              {pool.apr.toFixed(1)}%
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
