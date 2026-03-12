"use client";

import SwapCard from "@/components/SwapCard";

export default function SwapPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
      <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
        Swap Tokens
      </h1>
      <p className="text-dark-400 mb-8">
        Trade tokens instantly with minimal slippage
      </p>
      <SwapCard />
    </div>
  );
}
