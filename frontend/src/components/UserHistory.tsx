"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useUserSwaps, type SwapRecord } from "@/hooks/useIndexerApi";

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

export default function UserHistory() {
  const { publicKey, connected } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const { data: swaps, loading, error } = useUserSwaps(walletAddress);

  if (!connected) {
    return (
      <div className="bg-dark-900 border border-dark-700 rounded-2xl p-8 text-center">
        <svg
          className="w-12 h-12 mx-auto mb-3 text-dark-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 9V7a5 5 0 00-10 0v2M5 11h14a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2z"
          />
        </svg>
        <p className="text-dark-400 text-sm">
          Connect wallet to view your history
        </p>
      </div>
    );
  }

  return (
    <div className="bg-dark-900 border border-dark-700 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-dark-700">
        <h3 className="text-lg font-semibold">Your Trade History</h3>
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
                <th className="text-left px-4 py-2 font-medium">Pool</th>
                <th className="text-left px-4 py-2 font-medium">Direction</th>
                <th className="text-right px-4 py-2 font-medium">Amount In</th>
                <th className="text-right px-4 py-2 font-medium">
                  Amount Out
                </th>
                <th className="text-right px-4 py-2 font-medium">Fee</th>
                <th className="text-center px-4 py-2 font-medium">Tx</th>
              </tr>
            </thead>
            <tbody>
              {swaps.map((swap: SwapRecord, i: number) => {
                const directionLabel =
                  swap.swap_direction === 0 ? "A \u2192 B" : "B \u2192 A";
                const directionColor =
                  swap.swap_direction === 0
                    ? "text-green-400"
                    : "text-red-400";

                return (
                  <tr
                    key={swap.id || i}
                    onClick={() =>
                      window.open(
                        `https://explorer.solana.com/tx/${swap.signature}?cluster=devnet`,
                        "_blank"
                      )
                    }
                    className="border-b border-dark-800 cursor-pointer transition-colors hover:bg-dark-800"
                  >
                    <td className="px-4 py-2.5 text-dark-300 whitespace-nowrap">
                      {formatTimeAgo(swap.block_time)}
                    </td>
                    <td className="px-4 py-2.5 text-dark-400 font-mono">
                      {truncateAddress(swap.pool_address)}
                    </td>
                    <td className={`px-4 py-2.5 font-medium ${directionColor}`}>
                      {directionLabel}
                    </td>
                    <td className="px-4 py-2.5 text-right text-dark-200 font-mono">
                      {parseFloat(swap.amount_in).toFixed(4)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-dark-200 font-mono">
                      {parseFloat(swap.amount_out).toFixed(4)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-dark-400 font-mono">
                      {parseFloat(swap.fee_amount).toFixed(4)}
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
