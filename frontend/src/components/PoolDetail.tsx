"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface PoolDetailProps {
  poolId: string;
}

export default function PoolDetail({ poolId }: PoolDetailProps) {
  const { connected } = useWallet();
  const [activeTab, setActiveTab] = useState<"add" | "remove">("add");
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [lpAmount, setLpAmount] = useState("");

  // Mock pool data - in production, fetch from chain
  const pool = {
    tokenASymbol: "SOL",
    tokenBSymbol: "USDC",
    reserveA: 1500,
    reserveB: 150000,
    tvl: 300000,
    volume24h: 45000,
    feeRate: 25,
    yourLpTokens: 0,
    totalLpSupply: 15000,
  };

  const price = pool.reserveB / pool.reserveA;

  return (
    <div>
      {/* Pool Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex -space-x-3">
          <div className="w-12 h-12 rounded-full bg-primary-600 flex items-center justify-center text-lg font-bold border-2 border-dark-900 z-10">
            {pool.tokenASymbol[0]}
          </div>
          <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center text-lg font-bold border-2 border-dark-900">
            {pool.tokenBSymbol[0]}
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            {pool.tokenASymbol}/{pool.tokenBSymbol}
          </h1>
          <p className="text-dark-400">Fee: {(pool.feeRate / 100).toFixed(2)}%</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="TVL" value={`$${pool.tvl.toLocaleString()}`} />
        <StatCard
          label="24h Volume"
          value={`$${pool.volume24h.toLocaleString()}`}
        />
        <StatCard
          label={`${pool.tokenASymbol} Reserve`}
          value={pool.reserveA.toLocaleString()}
        />
        <StatCard
          label={`${pool.tokenBSymbol} Reserve`}
          value={pool.reserveB.toLocaleString()}
        />
      </div>

      {/* Price Info */}
      <div className="bg-dark-900 border border-dark-700 rounded-xl p-4 mb-8">
        <div className="text-sm text-dark-400 mb-1">Current Price</div>
        <div className="text-lg font-semibold">
          1 {pool.tokenASymbol} = {price.toFixed(2)} {pool.tokenBSymbol}
        </div>
      </div>

      {/* Liquidity Management */}
      <div className="bg-dark-900 border border-dark-700 rounded-2xl p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("add")}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "add"
                ? "bg-primary-600 text-white"
                : "bg-dark-800 text-dark-400 hover:text-white"
            }`}
          >
            Add Liquidity
          </button>
          <button
            onClick={() => setActiveTab("remove")}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "remove"
                ? "bg-primary-600 text-white"
                : "bg-dark-800 text-dark-400 hover:text-white"
            }`}
          >
            Remove Liquidity
          </button>
        </div>

        {activeTab === "add" ? (
          <div className="space-y-4">
            <div className="bg-dark-800 rounded-xl p-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-dark-400">{pool.tokenASymbol}</span>
                <span className="text-sm text-dark-400">Balance: --</span>
              </div>
              <input
                type="number"
                placeholder="0.00"
                value={amountA}
                onChange={(e) => setAmountA(e.target.value)}
                className="w-full bg-transparent text-xl font-semibold outline-none placeholder-dark-600"
              />
            </div>
            <div className="bg-dark-800 rounded-xl p-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-dark-400">{pool.tokenBSymbol}</span>
                <span className="text-sm text-dark-400">Balance: --</span>
              </div>
              <input
                type="number"
                placeholder="0.00"
                value={amountB}
                onChange={(e) => setAmountB(e.target.value)}
                className="w-full bg-transparent text-xl font-semibold outline-none placeholder-dark-600"
              />
            </div>
            <button
              disabled={!connected || !amountA || !amountB}
              className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
                connected && amountA && amountB
                  ? "bg-primary-600 hover:bg-primary-700 text-white"
                  : "bg-dark-700 text-dark-400 cursor-not-allowed"
              }`}
            >
              {!connected ? "Connect Wallet" : "Add Liquidity"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-dark-800 rounded-xl p-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-dark-400">LP Tokens</span>
                <span className="text-sm text-dark-400">
                  Balance: {pool.yourLpTokens}
                </span>
              </div>
              <input
                type="number"
                placeholder="0.00"
                value={lpAmount}
                onChange={(e) => setLpAmount(e.target.value)}
                className="w-full bg-transparent text-xl font-semibold outline-none placeholder-dark-600"
              />
            </div>
            {lpAmount && (
              <div className="bg-dark-800/50 rounded-xl p-4 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-dark-400">You will receive</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-300">{pool.tokenASymbol}</span>
                  <span>~{((parseFloat(lpAmount) / pool.totalLpSupply) * pool.reserveA).toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-300">{pool.tokenBSymbol}</span>
                  <span>~{((parseFloat(lpAmount) / pool.totalLpSupply) * pool.reserveB).toFixed(4)}</span>
                </div>
              </div>
            )}
            <button
              disabled={!connected || !lpAmount}
              className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
                connected && lpAmount
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-dark-700 text-dark-400 cursor-not-allowed"
              }`}
            >
              {!connected ? "Connect Wallet" : "Remove Liquidity"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-dark-900 border border-dark-700 rounded-xl p-4">
      <div className="text-sm text-dark-400 mb-1">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
