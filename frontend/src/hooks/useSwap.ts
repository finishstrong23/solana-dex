"use client";

import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { getProgram, PROGRAM_ID } from "@/utils/program";

const SPL_TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

function deriveAta(mint: PublicKey, owner: PublicKey): PublicKey {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), SPL_TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return address;
}

export function useSwap() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [priceImpact, setPriceImpact] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const estimateOutput = useCallback(
    (
      tokenAMint: string,
      tokenBMint: string,
      amountIn: number,
      direction: "AtoB" | "BtoA"
    ): number => {
      if (amountIn <= 0) {
        setPriceImpact(0);
        return 0;
      }

      // Mock reserves for UI estimation when pool data isn't loaded from chain
      const mockReserveA: number = 1000;
      const mockReserveB: number = 100000;
      const feeRate = 25; // 0.25%

      const reserveIn: number =
        direction === "AtoB" ? mockReserveA : mockReserveB;
      const reserveOut: number =
        direction === "AtoB" ? mockReserveB : mockReserveA;

      if (reserveIn <= 0 || reserveOut <= 0) {
        setPriceImpact(0);
        return 0;
      }

      const fee = (amountIn * feeRate) / 10000;
      const effectiveAmountIn = amountIn - fee;
      const amountOut =
        (reserveOut * effectiveAmountIn) / (reserveIn + effectiveAmountIn);

      // Calculate price impact safely
      const spotPrice = reserveOut / reserveIn;
      const executionPrice = amountIn > 0 ? amountOut / amountIn : 0;
      const impact =
        spotPrice > 0
          ? Math.abs((spotPrice - executionPrice) / spotPrice) * 100
          : 0;
      setPriceImpact(isFinite(impact) ? impact : 0);

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

      if (amountIn <= 0) {
        throw new Error("Amount must be greater than zero");
      }

      if (slippage < 0 || slippage > 50) {
        throw new Error("Slippage must be between 0% and 50%");
      }

      setLoading(true);
      setError(null);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        const tokenAKey = new PublicKey(tokenAMint);
        const tokenBKey = new PublicKey(tokenBMint);
        const [poolPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("pool"),
            tokenAKey.toBuffer(),
            tokenBKey.toBuffer(),
          ],
          PROGRAM_ID
        );

        // Fetch pool account to get vault addresses
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const poolAccount: any = await (program.account as any)["Pool"].fetch(
          poolPda
        );

        // Get user's associated token accounts
        const userTokenA = deriveAta(tokenAKey, wallet.publicKey);
        const userTokenB = deriveAta(tokenBKey, wallet.publicKey);

        // Convert amounts to lamports (assuming 6 decimals for SPL tokens)
        const amountInLamports = new BN(Math.floor(amountIn * 1e6));
        const minOutLamports = new BN(Math.floor(minOut * 1e6));

        // Build swap direction enum
        const swapDirection =
          direction === "AtoB" ? { aToB: {} } : { bToA: {} };

        // Execute the swap instruction on-chain
        const tx = await program.methods
          .swap(amountInLamports, minOutLamports, swapDirection)
          .accounts({
            pool: poolPda,
            userTokenA,
            userTokenB,
            tokenAVault: poolAccount.tokenAVault,
            tokenBVault: poolAccount.tokenBVault,
            user: wallet.publicKey,
            tokenProgram: SPL_TOKEN_PROGRAM_ID,
          })
          .rpc();

        return tx;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Swap failed";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [connection, wallet, estimateOutput]
  );

  return { swap, estimateOutput, loading, priceImpact, error };
}
