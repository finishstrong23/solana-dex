"use client";

import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { getProgram } from "@/utils/program";

export function useSwap() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [priceImpact, setPriceImpact] = useState(0);

  const estimateOutput = useCallback(
    (
      tokenAMint: string,
      tokenBMint: string,
      amountIn: number,
      direction: "AtoB" | "BtoA"
    ): number => {
      // In production, fetch pool state from chain
      // For now, use a mock calculation
      const mockReserveA = 1000;
      const mockReserveB = 100000;
      const feeRate = 25; // 0.25%

      const reserveIn = direction === "AtoB" ? mockReserveA : mockReserveB;
      const reserveOut = direction === "AtoB" ? mockReserveB : mockReserveA;

      const fee = (amountIn * feeRate) / 10000;
      const effectiveAmountIn = amountIn - fee;
      const amountOut =
        (reserveOut * effectiveAmountIn) / (reserveIn + effectiveAmountIn);

      // Calculate price impact
      const spotPrice = reserveOut / reserveIn;
      const executionPrice = amountOut / amountIn;
      const impact = Math.abs((spotPrice - executionPrice) / spotPrice) * 100;
      setPriceImpact(impact);

      return amountOut;
    },
    []
  );

  const swap = useCallback(
    async (
      tokenAMint: string,
      tokenBMint: string,
      amountIn: number,
      slippage: number,
      direction: "AtoB" | "BtoA"
    ): Promise<string> => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      try {
        const program = getProgram(connection, wallet as any);

        // Calculate min output with slippage
        const estimatedOut = estimateOutput(
          tokenAMint,
          tokenBMint,
          amountIn,
          direction
        );
        const minOut = Math.floor(estimatedOut * (1 - slippage / 100));

        // Find pool PDA
        const [poolPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("pool"),
            new PublicKey(tokenAMint).toBuffer(),
            new PublicKey(tokenBMint).toBuffer(),
          ],
          program.programId
        );

        // In production, fetch actual pool account to get vault addresses
        // For now, return a mock signature
        console.log("Swap params:", {
          pool: poolPda.toBase58(),
          amountIn,
          minOut,
          direction,
        });

        // TODO: Build and send actual transaction
        // const tx = await program.methods
        //   .swap(new BN(amountIn * 1e6), new BN(minOut * 1e6), { [direction === "AtoB" ? "aToB" : "bToA"]: {} })
        //   .accounts({...})
        //   .rpc();

        return "mock_signature_" + Date.now();
      } finally {
        setLoading(false);
      }
    },
    [connection, wallet, estimateOutput]
  );

  return { swap, estimateOutput, loading, priceImpact };
}
