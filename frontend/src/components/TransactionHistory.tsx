"use client";

import { useSwaps, type SwapRecord } from "@/hooks/useIndexerApi";

interface TransactionHistoryProps {
  poolAddress: string;
  compact?: boolean;
}

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 8) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export default function TransactionHistory({
  poolAddress,
  compact = false,
}: TransactionHistoryProps) {
  const { data: swaps, loading, error } = useSwaps(poolAddress, compact ? 5 : 50);

  const isBuy = (swap: SwapRecord) => swap.swap_direction === 0;

  return (
    <div className="bg-dark-900 border border-dark-700 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-dark-700">
        <h3 className="text-lg font-semibold">Recent Trades</h3>
      </div>

      {loading && !swaps ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="p-4 text-center text-red-400 text-sm">{error}</div>
      ) : !swaps || swaps.length === 0 ? (
        <div className="p-8 text-center text-dark-400 text-sm">
          No trades yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-dark-400 border-b border-dark-800">
                <th className="text-left px-4 py-2 font-medium">Time</th>
                <th className="text-left px-4 py-2 font-medium">Type</th>
                <th className="text-right px-4 py-2 font-medium">Price</th>
                <th className="text-right px-4 py-2 font-medium">Amount</th>
                {!compact && (
                  <>
                    <th className="text-right px-4 py-2 font-medium">Total</th>
                    <th className="text-left px-4 py-2 font-medium">Wallet</th>
                    <th className="text-center px-4 py-2 font-medium">Tx</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {swaps.map((swap, i) => {
                const buy = isBuy(swap);
                return (
                  <tr
                    key={swap.id || i}
                    onClick={() =>
                      window.open(
                        `https://explorer.solana.com/tx/${swap.signature}?cluster=devnet`,
                        "_blank"
                      )
                    }
                    className={`border-b border-dark-800 cursor-pointer transition-colors hover:bg-dark-800 ${
                      buy ? "bg-green-900/10" : "bg-red-900/10"
                    }`}
                  >
                    <td className="px-4 py-2.5 text-dark-300 whitespace-nowrap">
                      {formatTimeAgo(swap.block_time)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`font-medium ${
                          buy ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {buy ? "Buy" : "Sell"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-dark-200 font-mono">
                      {swap.price?.toFixed(6) ?? "--"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-dark-200 font-mono">
                      {parseFloat(swap.amount_in).toFixed(4)}
                    </td>
                    {!compact && (
                      <>
                        <td className="px-4 py-2.5 text-right text-dark-200 font-mono">
                          {parseFloat(swap.amount_out).toFixed(4)}
                        </td>
                        <td className="px-4 py-2.5 text-dark-400 font-mono">
                          {truncateAddress(swap.user_address)}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <a
                            href={`https://explorer.solana.com/tx/${swap.signature}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary-400 hover:text-primary-300"
                          >
                            <svg
                              className="w-4 h-4 inline"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </a>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
