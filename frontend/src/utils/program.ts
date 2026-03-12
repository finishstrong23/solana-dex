import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";

// Program ID - update this after deploying to devnet
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ||
    "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"
);

// Minimal IDL for type generation - replace with generated IDL after build
const IDL: Idl = {
  version: "0.1.0",
  name: "solana_dex",
  instructions: [
    {
      name: "initializePool",
      accounts: [
        { name: "pool", isMut: true, isSigner: false },
        { name: "tokenAMint", isMut: false, isSigner: false },
        { name: "tokenBMint", isMut: false, isSigner: false },
        { name: "tokenAVault", isMut: true, isSigner: true },
        { name: "tokenBVault", isMut: true, isSigner: true },
        { name: "lpMint", isMut: true, isSigner: true },
        { name: "admin", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "rent", isMut: false, isSigner: false },
      ],
      args: [{ name: "feeRate", type: "u16" }],
    },
    {
      name: "addLiquidity",
      accounts: [
        { name: "pool", isMut: true, isSigner: false },
        { name: "userTokenA", isMut: true, isSigner: false },
        { name: "userTokenB", isMut: true, isSigner: false },
        { name: "tokenAVault", isMut: true, isSigner: false },
        { name: "tokenBVault", isMut: true, isSigner: false },
        { name: "lpMint", isMut: true, isSigner: false },
        { name: "userLpToken", isMut: true, isSigner: false },
        { name: "user", isMut: false, isSigner: true },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "amountA", type: "u64" },
        { name: "amountB", type: "u64" },
        { name: "minLpTokens", type: "u64" },
      ],
    },
    {
      name: "removeLiquidity",
      accounts: [
        { name: "pool", isMut: true, isSigner: false },
        { name: "userTokenA", isMut: true, isSigner: false },
        { name: "userTokenB", isMut: true, isSigner: false },
        { name: "tokenAVault", isMut: true, isSigner: false },
        { name: "tokenBVault", isMut: true, isSigner: false },
        { name: "lpMint", isMut: true, isSigner: false },
        { name: "userLpToken", isMut: true, isSigner: false },
        { name: "user", isMut: false, isSigner: true },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "lpTokenAmount", type: "u64" },
        { name: "minAOut", type: "u64" },
        { name: "minBOut", type: "u64" },
      ],
    },
    {
      name: "swap",
      accounts: [
        { name: "pool", isMut: true, isSigner: false },
        { name: "userTokenA", isMut: true, isSigner: false },
        { name: "userTokenB", isMut: true, isSigner: false },
        { name: "tokenAVault", isMut: true, isSigner: false },
        { name: "tokenBVault", isMut: true, isSigner: false },
        { name: "user", isMut: false, isSigner: true },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "amountIn", type: "u64" },
        { name: "minAmountOut", type: "u64" },
        {
          name: "swapDirection",
          type: { defined: "SwapDirection" },
        },
      ],
    },
    {
      name: "collectProtocolFees",
      accounts: [
        { name: "pool", isMut: true, isSigner: false },
        { name: "tokenAVault", isMut: true, isSigner: false },
        { name: "tokenBVault", isMut: true, isSigner: false },
        { name: "treasuryTokenA", isMut: true, isSigner: false },
        { name: "treasuryTokenB", isMut: true, isSigner: false },
        { name: "admin", isMut: false, isSigner: true },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "Pool",
      type: {
        kind: "struct",
        fields: [
          { name: "tokenAMint", type: "publicKey" },
          { name: "tokenBMint", type: "publicKey" },
          { name: "tokenAVault", type: "publicKey" },
          { name: "tokenBVault", type: "publicKey" },
          { name: "lpMint", type: "publicKey" },
          { name: "feeRate", type: "u16" },
          { name: "protocolFeeRate", type: "u16" },
          { name: "reserveA", type: "u64" },
          { name: "reserveB", type: "u64" },
          { name: "protocolFeesA", type: "u64" },
          { name: "protocolFeesB", type: "u64" },
          { name: "admin", type: "publicKey" },
          { name: "bump", type: "u8" },
          { name: "totalLpSupply", type: "u64" },
        ],
      },
    },
  ],
  types: [
    {
      name: "SwapDirection",
      type: {
        kind: "enum",
        variants: [{ name: "AToB" }, { name: "BToA" }],
      },
    },
  ],
  errors: [
    { code: 6000, name: "InsufficientLiquidity", msg: "Insufficient liquidity in the pool" },
    { code: 6001, name: "SlippageExceeded", msg: "Slippage tolerance exceeded" },
    { code: 6002, name: "InvalidFeeRate", msg: "Invalid fee rate" },
    { code: 6003, name: "ZeroAmount", msg: "Amount must be greater than zero" },
    { code: 6004, name: "IdenticalMints", msg: "Cannot create pool with identical mints" },
    { code: 6005, name: "Unauthorized", msg: "Unauthorized" },
    { code: 6006, name: "MathOverflow", msg: "Math overflow" },
    { code: 6007, name: "NoProtocolFees", msg: "No protocol fees to collect" },
  ],
};

export function getProgram(connection: Connection, wallet: any): Program {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  return new Program(IDL, PROGRAM_ID, provider);
}

export function findPoolPda(
  tokenAMint: PublicKey,
  tokenBMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), tokenAMint.toBuffer(), tokenBMint.toBuffer()],
    PROGRAM_ID
  );
}
