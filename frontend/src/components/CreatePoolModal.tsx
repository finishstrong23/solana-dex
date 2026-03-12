"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import TokenSelector from "./TokenSelector";

interface CreatePoolModalProps {
  onClose: () => void;
}

export default function CreatePoolModal({ onClose }: CreatePoolModalProps) {
  const { connected } = useWallet();
  const [tokenA, setTokenA] = useState("");
  const [tokenB, setTokenB] = useState("");
  const [feeRate, setFeeRate] = useState(25); // 0.25%
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!tokenA || !tokenB) return;
    setLoading(true);
    try {
      // TODO: Call initialize_pool instruction
      console.log("Creating pool:", { tokenA, tokenB, feeRate });
      onClose();
    } catch (err) {
      console.error("Failed to create pool:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-dark-900 border border-dark-700 rounded-2xl p-8 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Create New Pool</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-dark-800 text-dark-400"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Token A Selection */}
        <div className="mb-4">
          <label className="text-sm text-dark-400 mb-2 block">Token A</label>
          <div className="bg-dark-800 rounded-xl p-4">
            <TokenSelector
              selectedToken={tokenA}
              onSelect={setTokenA}
              excludeToken={tokenB}
            />
          </div>
        </div>

        {/* Token B Selection */}
        <div className="mb-4">
          <label className="text-sm text-dark-400 mb-2 block">Token B</label>
          <div className="bg-dark-800 rounded-xl p-4">
            <TokenSelector
              selectedToken={tokenB}
              onSelect={setTokenB}
              excludeToken={tokenA}
            />
          </div>
        </div>

        {/* Fee Rate */}
        <div className="mb-6">
          <label className="text-sm text-dark-400 mb-2 block">
            Fee Rate (basis points)
          </label>
          <div className="flex items-center gap-2">
            {[10, 25, 30, 100].map((rate) => (
              <button
                key={rate}
                onClick={() => setFeeRate(rate)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  feeRate === rate
                    ? "bg-primary-600 text-white"
                    : "bg-dark-700 text-dark-300 hover:bg-dark-600"
                }`}
              >
                {(rate / 100).toFixed(2)}%
              </button>
            ))}
          </div>
          <p className="text-xs text-dark-500 mt-2">
            {feeRate} basis points = {(feeRate / 100).toFixed(2)}% per trade
          </p>
        </div>

        <button
          onClick={handleCreate}
          disabled={!connected || !tokenA || !tokenB || loading}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
            connected && tokenA && tokenB && !loading
              ? "bg-primary-600 hover:bg-primary-700 text-white"
              : "bg-dark-700 text-dark-400 cursor-not-allowed"
          }`}
        >
          {!connected
            ? "Connect Wallet"
            : loading
            ? "Creating..."
            : "Create Pool"}
        </button>
      </div>
    </div>
  );
}
