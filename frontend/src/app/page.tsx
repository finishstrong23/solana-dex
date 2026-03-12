"use client";

import { useState } from "react";
import SwapCard from "@/components/SwapCard";
import PriceChart from "@/components/PriceChart";
import TransactionHistory from "@/components/TransactionHistory";

// Default pool address for the main trading pair
const DEFAULT_POOL = "PooCfGkJiVEZs8aH7YHrSqPq5bBJFdRbvQ7a1L7Dpoo";

export default function SwapPage() {
  const [selectedPool] = useState(DEFAULT_POOL);

  return (
    <div className="flex flex-col items-center min-h-[80vh]">
      <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
        Swap Tokens
      </h1>
      <p className="text-dark-400 mb-8">
        Trade tokens instantly with minimal slippage
      </p>

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Swap Card */}
        <div className="flex justify-center lg:justify-end">
          <SwapCard />
        </div>

        {/* Mini Chart + Recent Trades */}
        <div className="space-y-4">
          <PriceChart poolAddress={selectedPool} height={200} />
          <div className="bg-dark-900 border border-dark-700 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-dark-400 mb-3">
              Recent Trades
            </h3>
            <TransactionHistory poolAddress={selectedPool} compact />
          </div>
        </div>
      </div>
    </div>
  );
}
