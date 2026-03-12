"use client";

import { usePools } from "@/hooks/usePools";
import { useProtocolStats } from "@/hooks/useIndexerApi";

export default function Dashboard() {
  const { pools } = usePools();
  const { data: protocolStats } = useProtocolStats();

  // Use indexer data when available, fall back to local calculations
  const totalTvl = protocolStats?.total_tvl ?? pools.reduce((sum, p) => sum + p.tvl, 0);
  const totalVolume24h = protocolStats?.total_24h_volume ?? pools.reduce((sum, p) => sum + p.volume24h, 0);
  const totalFees24h = protocolStats?.total_24h_fees ?? pools.reduce(
    (sum, p) => sum + (p.volume24h * p.feeRate) / 10000,
    0
  );
  const totalPools = protocolStats?.total_pools ?? pools.length;
  const totalSwaps = protocolStats?.total_swaps ?? 0;

  return (
    <div>
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Total Value Locked"
          value={`$${totalTvl.toLocaleString()}`}
        />
        <MetricCard
          title="24h Volume"
          value={`$${totalVolume24h.toLocaleString()}`}
        />
        <MetricCard
          title="24h Fees Earned"
          value={`$${totalFees24h.toLocaleString()}`}
        />
        <MetricCard
          title="Total Swaps"
          value={totalSwaps.toLocaleString()}
        />
      </div>

      {/* Protocol Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-dark-900 border border-dark-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4">Protocol Info</h3>
          <div className="space-y-3">
            <InfoRow label="Network" value="Solana Devnet" />
            <InfoRow label="AMM Type" value="Constant Product (x * y = k)" />
            <InfoRow label="Total Pools" value={totalPools.toString()} />
            <InfoRow label="Protocol Fee" value="0.05% (20% of trading fee)" />
          </div>
        </div>

        <div className="bg-dark-900 border border-dark-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4">Fee Distribution</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-dark-400">LP Providers</span>
                <span>80%</span>
              </div>
              <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                <div className="h-full w-4/5 bg-primary-500 rounded-full"></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-dark-400">Protocol Treasury</span>
                <span>20%</span>
              </div>
              <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                <div className="h-full w-1/5 bg-green-500 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Pools by Volume */}
      <div className="bg-dark-900 border border-dark-700 rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-4">Top Pools by 24h Volume</h3>
        {pools.length === 0 ? (
          <p className="text-dark-400 text-center py-8">
            No pools created yet
          </p>
        ) : (
          <div>
            {/* Header */}
            <div className="grid grid-cols-5 gap-4 px-4 py-2 text-xs text-dark-400 font-medium border-b border-dark-700">
              <span>#</span>
              <span>Pool</span>
              <span className="text-right">TVL</span>
              <span className="text-right">24h Volume</span>
              <span className="text-right">APR</span>
            </div>
            <div className="space-y-1 mt-1">
              {[...pools]
                .sort((a, b) => b.volume24h - a.volume24h)
                .slice(0, 10)
                .map((pool, i) => (
                  <div
                    key={pool.address}
                    className="grid grid-cols-5 gap-4 px-4 py-3 rounded-lg hover:bg-dark-800/50 transition-colors"
                  >
                    <span className="text-dark-500 text-sm">#{i + 1}</span>
                    <span className="font-medium">
                      {pool.tokenASymbol}/{pool.tokenBSymbol}
                    </span>
                    <span className="text-right">
                      ${pool.tvl.toLocaleString()}
                    </span>
                    <span className="text-right text-dark-300">
                      ${pool.volume24h.toLocaleString()}
                    </span>
                    <span className="text-right text-green-400 font-medium">
                      {pool.apr.toFixed(1)}%
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="bg-dark-900 border border-dark-700 rounded-2xl p-6">
      <div className="text-sm text-dark-400 mb-1">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-dark-800 last:border-0">
      <span className="text-dark-400">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
