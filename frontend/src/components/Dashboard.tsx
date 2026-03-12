"use client";

import { usePools } from "@/hooks/usePools";

export default function Dashboard() {
  const { pools } = usePools();

  // Aggregate stats
  const totalTvl = pools.reduce((sum, p) => sum + p.tvl, 0);
  const totalVolume24h = pools.reduce((sum, p) => sum + p.volume24h, 0);
  const totalFees24h = pools.reduce(
    (sum, p) => sum + (p.volume24h * p.feeRate) / 10000,
    0
  );

  return (
    <div>
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <MetricCard
          title="Total Value Locked"
          value={`$${totalTvl.toLocaleString()}`}
          change="+12.5%"
          positive
        />
        <MetricCard
          title="24h Volume"
          value={`$${totalVolume24h.toLocaleString()}`}
          change="+8.3%"
          positive
        />
        <MetricCard
          title="24h Fees Earned"
          value={`$${totalFees24h.toLocaleString()}`}
          change="+15.2%"
          positive
        />
      </div>

      {/* Protocol Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-dark-900 border border-dark-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4">Protocol Info</h3>
          <div className="space-y-3">
            <InfoRow label="Network" value="Solana Devnet" />
            <InfoRow label="AMM Type" value="Constant Product (x * y = k)" />
            <InfoRow label="Total Pools" value={pools.length.toString()} />
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

      {/* Top Pools */}
      <div className="bg-dark-900 border border-dark-700 rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-4">Top Pools by TVL</h3>
        {pools.length === 0 ? (
          <p className="text-dark-400 text-center py-8">
            No pools created yet
          </p>
        ) : (
          <div className="space-y-3">
            {pools
              .sort((a, b) => b.tvl - a.tvl)
              .slice(0, 5)
              .map((pool, i) => (
                <div
                  key={pool.address}
                  className="flex items-center justify-between py-3 border-b border-dark-700 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-dark-500 text-sm w-6">
                      #{i + 1}
                    </span>
                    <span className="font-medium">
                      {pool.tokenASymbol}/{pool.tokenBSymbol}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      ${pool.tvl.toLocaleString()}
                    </div>
                    <div className="text-xs text-green-400">
                      {pool.apr.toFixed(1)}% APR
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  change,
  positive,
}: {
  title: string;
  value: string;
  change: string;
  positive: boolean;
}) {
  return (
    <div className="bg-dark-900 border border-dark-700 rounded-2xl p-6">
      <div className="text-sm text-dark-400 mb-1">{title}</div>
      <div className="text-2xl font-bold mb-2">{value}</div>
      <div
        className={`text-sm font-medium ${
          positive ? "text-green-400" : "text-red-400"
        }`}
      >
        {change} (24h)
      </div>
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
