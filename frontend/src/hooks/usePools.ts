"use client";

import { useState, useEffect } from "react";
import { useConnection } from "@solana/wallet-adapter-react";

export interface PoolInfo {
  address: string;
  tokenAMint: string;
  tokenBMint: string;
  tokenASymbol: string;
  tokenBSymbol: string;
  reserveA: number;
  reserveB: number;
  tvl: number;
  volume24h: number;
  feeRate: number;
  apr: number;
  totalLpSupply: number;
}

// Mock data for initial development
const MOCK_POOLS: PoolInfo[] = [
  {
    address: "PooCfGkJiVEZs8aH7YHrSqPq5bBJFdRbvQ7a1L7Dpoo",
    tokenAMint: "So11111111111111111111111111111111111111112",
    tokenBMint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    tokenASymbol: "SOL",
    tokenBSymbol: "USDC",
    reserveA: 15000,
    reserveB: 1500000,
    tvl: 3000000,
    volume24h: 450000,
    feeRate: 25,
    apr: 18.5,
    totalLpSupply: 150000,
  },
  {
    address: "PooBfGkJiVEZs8aH7YHrSqPq5bBJFdRbvQ7a1L7Dpoo",
    tokenAMint: "So11111111111111111111111111111111111111112",
    tokenBMint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    tokenASymbol: "SOL",
    tokenBSymbol: "USDT",
    reserveA: 8000,
    reserveB: 800000,
    tvl: 1600000,
    volume24h: 220000,
    feeRate: 25,
    apr: 12.3,
    totalLpSupply: 80000,
  },
];

export function usePools() {
  const { connection } = useConnection();
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPools() {
      try {
        // TODO: In production, fetch all pool accounts from the program
        // const program = getProgram(connection, wallet);
        // const allPools = await program.account.pool.all();

        // For now, use mock data
        setPools(MOCK_POOLS);
      } catch (err) {
        console.error("Failed to fetch pools:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchPools();
  }, [connection]);

  return { pools, loading };
}
