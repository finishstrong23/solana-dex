"use client";

import { useState } from "react";

// Sample tokens for devnet
const TOKENS = [
  { symbol: "SOL", name: "Solana", mint: "So11111111111111111111111111111111111111112" },
  { symbol: "USDC", name: "USD Coin", mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" },
  { symbol: "USDT", name: "Tether", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" },
  { symbol: "RAY", name: "Raydium", mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R" },
];

interface TokenSelectorProps {
  selectedToken: string;
  onSelect: (mint: string) => void;
  excludeToken?: string;
}

export default function TokenSelector({
  selectedToken,
  onSelect,
  excludeToken,
}: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selected = TOKENS.find((t) => t.mint === selectedToken);
  const available = TOKENS.filter((t) => t.mint !== excludeToken);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-xl transition-colors"
      >
        {selected ? (
          <>
            <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center text-xs font-bold">
              {selected.symbol[0]}
            </div>
            <span className="font-semibold">{selected.symbol}</span>
          </>
        ) : (
          <span className="text-dark-400">Select</span>
        )}
        <svg
          className="w-4 h-4 text-dark-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-dark-800 border border-dark-600 rounded-xl shadow-xl z-50 overflow-hidden">
          {available.map((token) => (
            <button
              key={token.mint}
              onClick={() => {
                onSelect(token.mint);
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-700 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary-600/30 flex items-center justify-center text-sm font-bold text-primary-400">
                {token.symbol[0]}
              </div>
              <div className="text-left">
                <div className="font-medium">{token.symbol}</div>
                <div className="text-xs text-dark-400">{token.name}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
