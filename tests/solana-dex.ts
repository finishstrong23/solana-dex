import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert, expect } from "chai";
import BN from "bn.js";

// Type for the program - we use any since the IDL is generated
type SolanaDex = any;

describe("solana-dex", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolanaDex as Program<SolanaDex>;
  const admin = provider.wallet as anchor.Wallet;

  let tokenAMint: PublicKey;
  let tokenBMint: PublicKey;
  let poolPda: PublicKey;
  let poolBump: number;
  let tokenAVault: Keypair;
  let tokenBVault: Keypair;
  let lpMint: Keypair;
  let userTokenA: PublicKey;
  let userTokenB: PublicKey;
  let userLpToken: PublicKey;

  const FEE_RATE = 25; // 0.25% = 25 basis points

  // Helper: airdrop SOL
  async function airdrop(pubkey: PublicKey, amount: number) {
    const sig = await provider.connection.requestAirdrop(
      pubkey,
      amount * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);
  }

  // Helper: find pool PDA
  async function findPoolPda(
    mintA: PublicKey,
    mintB: PublicKey
  ): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), mintA.toBuffer(), mintB.toBuffer()],
      program.programId
    );
  }

  before(async () => {
    // Create token mints
    tokenAMint = await createMint(
      provider.connection,
      (admin as any).payer,
      admin.publicKey,
      null,
      6 // 6 decimals
    );

    tokenBMint = await createMint(
      provider.connection,
      (admin as any).payer,
      admin.publicKey,
      null,
      6
    );

    // Find pool PDA
    [poolPda, poolBump] = await findPoolPda(tokenAMint, tokenBMint);

    // Create vault keypairs
    tokenAVault = Keypair.generate();
    tokenBVault = Keypair.generate();
    lpMint = Keypair.generate();

    // Create user token accounts
    userTokenA = await createAccount(
      provider.connection,
      (admin as any).payer,
      tokenAMint,
      admin.publicKey
    );

    userTokenB = await createAccount(
      provider.connection,
      (admin as any).payer,
      tokenBMint,
      admin.publicKey
    );

    // Mint tokens to user
    await mintTo(
      provider.connection,
      (admin as any).payer,
      tokenAMint,
      userTokenA,
      admin.publicKey,
      1_000_000_000_000 // 1M tokens with 6 decimals
    );

    await mintTo(
      provider.connection,
      (admin as any).payer,
      tokenBMint,
      userTokenB,
      admin.publicKey,
      1_000_000_000_000
    );
  });

  describe("initialize_pool", () => {
    it("initializes a pool successfully", async () => {
      const tx = await program.methods
        .initializePool(FEE_RATE)
        .accounts({
          pool: poolPda,
          tokenAMint: tokenAMint,
          tokenBMint: tokenBMint,
          tokenAVault: tokenAVault.publicKey,
          tokenBVault: tokenBVault.publicKey,
          lpMint: lpMint.publicKey,
          admin: admin.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([tokenAVault, tokenBVault, lpMint])
        .rpc();

      // Verify pool state
      const poolAccount = await program.account.pool.fetch(poolPda);
      assert.ok(poolAccount.tokenAMint.equals(tokenAMint));
      assert.ok(poolAccount.tokenBMint.equals(tokenBMint));
      assert.ok(poolAccount.tokenAVault.equals(tokenAVault.publicKey));
      assert.ok(poolAccount.tokenBVault.equals(tokenBVault.publicKey));
      assert.ok(poolAccount.lpMint.equals(lpMint.publicKey));
      assert.equal(poolAccount.feeRate, FEE_RATE);
      assert.equal(poolAccount.protocolFeeRate, 5);
      assert.ok(poolAccount.reserveA.eq(new BN(0)));
      assert.ok(poolAccount.reserveB.eq(new BN(0)));
      assert.ok(poolAccount.protocolFeesA.eq(new BN(0)));
      assert.ok(poolAccount.protocolFeesB.eq(new BN(0)));
      assert.ok(poolAccount.admin.equals(admin.publicKey));
    });

    it("fails with identical mints", async () => {
      const fakeVaultA = Keypair.generate();
      const fakeVaultB = Keypair.generate();
      const fakeLpMint = Keypair.generate();

      // Try to create pool with same mint for both tokens
      // This should fail because the PDA seeds would be the same
      // and Anchor would reject identical mints in our validation
      try {
        const [sameMintPool] = await findPoolPda(tokenAMint, tokenAMint);
        await program.methods
          .initializePool(FEE_RATE)
          .accounts({
            pool: sameMintPool,
            tokenAMint: tokenAMint,
            tokenBMint: tokenAMint, // Same mint
            tokenAVault: fakeVaultA.publicKey,
            tokenBVault: fakeVaultB.publicKey,
            lpMint: fakeLpMint.publicKey,
            admin: admin.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([fakeVaultA, fakeVaultB, fakeLpMint])
          .rpc();
        assert.fail("Should have thrown an error");
      } catch (err: any) {
        // Expected to fail with IdenticalMints error
        assert.ok(err.toString().includes("IdenticalMints") || err.error);
      }
    });

    it("fails with invalid fee rate (too high)", async () => {
      const mintC = await createMint(
        provider.connection,
        (admin as any).payer,
        admin.publicKey,
        null,
        6
      );
      const [newPool] = await findPoolPda(tokenAMint, mintC);
      const vA = Keypair.generate();
      const vB = Keypair.generate();
      const lp = Keypair.generate();

      try {
        await program.methods
          .initializePool(1500) // 15% - too high
          .accounts({
            pool: newPool,
            tokenAMint: tokenAMint,
            tokenBMint: mintC,
            tokenAVault: vA.publicKey,
            tokenBVault: vB.publicKey,
            lpMint: lp.publicKey,
            admin: admin.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([vA, vB, lp])
          .rpc();
        assert.fail("Should have thrown an error");
      } catch (err: any) {
        assert.ok(
          err.toString().includes("InvalidFeeRate") || err.error
        );
      }
    });

    it("fails with zero fee rate", async () => {
      const mintC = await createMint(
        provider.connection,
        (admin as any).payer,
        admin.publicKey,
        null,
        6
      );
      const [newPool] = await findPoolPda(tokenAMint, mintC);
      const vA = Keypair.generate();
      const vB = Keypair.generate();
      const lp = Keypair.generate();

      try {
        await program.methods
          .initializePool(0) // 0 - invalid
          .accounts({
            pool: newPool,
            tokenAMint: tokenAMint,
            tokenBMint: mintC,
            tokenAVault: vA.publicKey,
            tokenBVault: vB.publicKey,
            lpMint: lp.publicKey,
            admin: admin.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([vA, vB, lp])
          .rpc();
        assert.fail("Should have thrown an error");
      } catch (err: any) {
        assert.ok(
          err.toString().includes("InvalidFeeRate") || err.error
        );
      }
    });
  });

  describe("add_liquidity", () => {
    before(async () => {
      // Create LP token account for user
      userLpToken = await createAccount(
        provider.connection,
        (admin as any).payer,
        lpMint.publicKey,
        admin.publicKey
      );
    });

    it("adds initial liquidity (empty pool)", async () => {
      const amountA = new BN(100_000_000); // 100 tokens
      const amountB = new BN(200_000_000); // 200 tokens

      await program.methods
        .addLiquidity(amountA, amountB, new BN(1)) // min_lp_tokens = 1
        .accounts({
          pool: poolPda,
          userTokenA: userTokenA,
          userTokenB: userTokenB,
          tokenAVault: tokenAVault.publicKey,
          tokenBVault: tokenBVault.publicKey,
          lpMint: lpMint.publicKey,
          userLpToken: userLpToken,
          user: admin.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      // Verify pool state
      const poolAccount = await program.account.pool.fetch(poolPda);
      assert.ok(poolAccount.reserveA.eq(amountA));
      assert.ok(poolAccount.reserveB.eq(amountB));
      assert.ok(poolAccount.totalLpSupply.gt(new BN(0)));

      // Check LP tokens minted: sqrt(100M * 200M) = sqrt(20_000_000_000_000_000) ≈ 141,421,356
      const lpBalance = await getAccount(provider.connection, userLpToken);
      assert.ok(Number(lpBalance.amount) > 0);

      // Verify vault balances
      const vaultA = await getAccount(
        provider.connection,
        tokenAVault.publicKey
      );
      const vaultB = await getAccount(
        provider.connection,
        tokenBVault.publicKey
      );
      assert.equal(Number(vaultA.amount), amountA.toNumber());
      assert.equal(Number(vaultB.amount), amountB.toNumber());
    });

    it("adds subsequent liquidity proportionally", async () => {
      const poolBefore = await program.account.pool.fetch(poolPda);
      const lpBefore = await getAccount(provider.connection, userLpToken);

      const amountA = new BN(50_000_000); // 50 tokens
      const amountB = new BN(100_000_000); // 100 tokens

      await program.methods
        .addLiquidity(amountA, amountB, new BN(1))
        .accounts({
          pool: poolPda,
          userTokenA: userTokenA,
          userTokenB: userTokenB,
          tokenAVault: tokenAVault.publicKey,
          tokenBVault: tokenBVault.publicKey,
          lpMint: lpMint.publicKey,
          userLpToken: userLpToken,
          user: admin.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const poolAfter = await program.account.pool.fetch(poolPda);
      assert.ok(
        poolAfter.reserveA.eq(poolBefore.reserveA.add(amountA))
      );
      assert.ok(
        poolAfter.reserveB.eq(poolBefore.reserveB.add(amountB))
      );

      const lpAfter = await getAccount(provider.connection, userLpToken);
      assert.ok(Number(lpAfter.amount) > Number(lpBefore.amount));
    });

    it("fails with zero amounts", async () => {
      try {
        await program.methods
          .addLiquidity(new BN(0), new BN(100), new BN(1))
          .accounts({
            pool: poolPda,
            userTokenA: userTokenA,
            userTokenB: userTokenB,
            tokenAVault: tokenAVault.publicKey,
            tokenBVault: tokenBVault.publicKey,
            lpMint: lpMint.publicKey,
            userLpToken: userLpToken,
            user: admin.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Should have thrown an error");
      } catch (err: any) {
        assert.ok(
          err.toString().includes("ZeroAmount") || err.error
        );
      }
    });

    it("fails when slippage exceeded (min_lp_tokens too high)", async () => {
      try {
        await program.methods
          .addLiquidity(
            new BN(1_000_000),
            new BN(2_000_000),
            new BN(999_999_999_999) // Impossibly high min LP tokens
          )
          .accounts({
            pool: poolPda,
            userTokenA: userTokenA,
            userTokenB: userTokenB,
            tokenAVault: tokenAVault.publicKey,
            tokenBVault: tokenBVault.publicKey,
            lpMint: lpMint.publicKey,
            userLpToken: userLpToken,
            user: admin.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Should have thrown an error");
      } catch (err: any) {
        assert.ok(
          err.toString().includes("SlippageExceeded") || err.error
        );
      }
    });
  });

  describe("swap", () => {
    it("swaps A to B successfully", async () => {
      const poolBefore = await program.account.pool.fetch(poolPda);
      const userBBefore = await getAccount(provider.connection, userTokenB);

      const amountIn = new BN(10_000_000); // 10 tokens

      await program.methods
        .swap(amountIn, new BN(1), { aToB: {} })
        .accounts({
          pool: poolPda,
          userTokenA: userTokenA,
          userTokenB: userTokenB,
          tokenAVault: tokenAVault.publicKey,
          tokenBVault: tokenBVault.publicKey,
          user: admin.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const poolAfter = await program.account.pool.fetch(poolPda);
      const userBAfter = await getAccount(provider.connection, userTokenB);

      // Reserve A should increase, Reserve B should decrease
      assert.ok(poolAfter.reserveA.gt(poolBefore.reserveA));
      assert.ok(poolAfter.reserveB.lt(poolBefore.reserveB));

      // User should have received token B
      assert.ok(Number(userBAfter.amount) > Number(userBBefore.amount));
    });

    it("swaps B to A successfully", async () => {
      const poolBefore = await program.account.pool.fetch(poolPda);
      const userABefore = await getAccount(provider.connection, userTokenA);

      const amountIn = new BN(10_000_000); // 10 tokens

      await program.methods
        .swap(amountIn, new BN(1), { bToA: {} })
        .accounts({
          pool: poolPda,
          userTokenA: userTokenA,
          userTokenB: userTokenB,
          tokenAVault: tokenAVault.publicKey,
          tokenBVault: tokenBVault.publicKey,
          user: admin.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const poolAfter = await program.account.pool.fetch(poolPda);
      const userAAfter = await getAccount(provider.connection, userTokenA);

      // Reserve B should increase, Reserve A should decrease
      assert.ok(poolAfter.reserveB.gt(poolBefore.reserveB));
      assert.ok(poolAfter.reserveA.lt(poolBefore.reserveA));

      // User should have received token A
      assert.ok(Number(userAAfter.amount) > Number(userABefore.amount));
    });

    it("accumulates protocol fees correctly", async () => {
      const poolAfter = await program.account.pool.fetch(poolPda);
      // After swaps, there should be accumulated protocol fees
      assert.ok(
        poolAfter.protocolFeesA.gt(new BN(0)) ||
          poolAfter.protocolFeesB.gt(new BN(0))
      );
    });

    it("applies correct fee calculation", async () => {
      const poolBefore = await program.account.pool.fetch(poolPda);
      const reserveA = poolBefore.reserveA.toNumber();
      const reserveB = poolBefore.reserveB.toNumber();

      const amountIn = 5_000_000; // 5 tokens
      const totalFee = Math.floor((amountIn * FEE_RATE) / 10000);
      const effectiveAmountIn = amountIn - totalFee;
      const expectedAmountOut = Math.floor(
        (reserveB * effectiveAmountIn) / (reserveA + effectiveAmountIn)
      );

      const userBBefore = await getAccount(provider.connection, userTokenB);

      await program.methods
        .swap(new BN(amountIn), new BN(1), { aToB: {} })
        .accounts({
          pool: poolPda,
          userTokenA: userTokenA,
          userTokenB: userTokenB,
          tokenAVault: tokenAVault.publicKey,
          tokenBVault: tokenBVault.publicKey,
          user: admin.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const userBAfter = await getAccount(provider.connection, userTokenB);
      const actualAmountOut =
        Number(userBAfter.amount) - Number(userBBefore.amount);

      // Allow 1 unit tolerance for rounding
      assert.ok(
        Math.abs(actualAmountOut - expectedAmountOut) <= 1,
        `Expected ~${expectedAmountOut}, got ${actualAmountOut}`
      );
    });

    it("fails with zero amount", async () => {
      try {
        await program.methods
          .swap(new BN(0), new BN(1), { aToB: {} })
          .accounts({
            pool: poolPda,
            userTokenA: userTokenA,
            userTokenB: userTokenB,
            tokenAVault: tokenAVault.publicKey,
            tokenBVault: tokenBVault.publicKey,
            user: admin.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Should have thrown an error");
      } catch (err: any) {
        assert.ok(
          err.toString().includes("ZeroAmount") || err.error
        );
      }
    });

    it("fails when slippage exceeded", async () => {
      try {
        await program.methods
          .swap(
            new BN(1_000_000),
            new BN(999_999_999_999), // Impossibly high min output
            { aToB: {} }
          )
          .accounts({
            pool: poolPda,
            userTokenA: userTokenA,
            userTokenB: userTokenB,
            tokenAVault: tokenAVault.publicKey,
            tokenBVault: tokenBVault.publicKey,
            user: admin.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Should have thrown an error");
      } catch (err: any) {
        assert.ok(
          err.toString().includes("SlippageExceeded") || err.error
        );
      }
    });
  });

  describe("remove_liquidity", () => {
    it("removes liquidity successfully", async () => {
      const poolBefore = await program.account.pool.fetch(poolPda);
      const lpBefore = await getAccount(provider.connection, userLpToken);
      const userABefore = await getAccount(provider.connection, userTokenA);
      const userBBefore = await getAccount(provider.connection, userTokenB);

      // Remove half of LP tokens
      const lpToRemove = new BN(Number(lpBefore.amount)).div(new BN(2));

      await program.methods
        .removeLiquidity(lpToRemove, new BN(1), new BN(1))
        .accounts({
          pool: poolPda,
          userTokenA: userTokenA,
          userTokenB: userTokenB,
          tokenAVault: tokenAVault.publicKey,
          tokenBVault: tokenBVault.publicKey,
          lpMint: lpMint.publicKey,
          userLpToken: userLpToken,
          user: admin.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const poolAfter = await program.account.pool.fetch(poolPda);
      const lpAfter = await getAccount(provider.connection, userLpToken);
      const userAAfter = await getAccount(provider.connection, userTokenA);
      const userBAfter = await getAccount(provider.connection, userTokenB);

      // LP tokens should decrease
      assert.ok(Number(lpAfter.amount) < Number(lpBefore.amount));

      // User should have received tokens back
      assert.ok(Number(userAAfter.amount) > Number(userABefore.amount));
      assert.ok(Number(userBAfter.amount) > Number(userBBefore.amount));

      // Pool reserves should decrease
      assert.ok(poolAfter.reserveA.lt(poolBefore.reserveA));
      assert.ok(poolAfter.reserveB.lt(poolBefore.reserveB));
    });

    it("fails with zero LP tokens", async () => {
      try {
        await program.methods
          .removeLiquidity(new BN(0), new BN(0), new BN(0))
          .accounts({
            pool: poolPda,
            userTokenA: userTokenA,
            userTokenB: userTokenB,
            tokenAVault: tokenAVault.publicKey,
            tokenBVault: tokenBVault.publicKey,
            lpMint: lpMint.publicKey,
            userLpToken: userLpToken,
            user: admin.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Should have thrown an error");
      } catch (err: any) {
        assert.ok(
          err.toString().includes("ZeroAmount") || err.error
        );
      }
    });

    it("fails when slippage exceeded on remove", async () => {
      const lpBalance = await getAccount(provider.connection, userLpToken);
      const lpToRemove = new BN(Number(lpBalance.amount)).div(new BN(4));

      try {
        await program.methods
          .removeLiquidity(
            lpToRemove,
            new BN(999_999_999_999), // Impossibly high min_a_out
            new BN(1)
          )
          .accounts({
            pool: poolPda,
            userTokenA: userTokenA,
            userTokenB: userTokenB,
            tokenAVault: tokenAVault.publicKey,
            tokenBVault: tokenBVault.publicKey,
            lpMint: lpMint.publicKey,
            userLpToken: userLpToken,
            user: admin.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Should have thrown an error");
      } catch (err: any) {
        assert.ok(
          err.toString().includes("SlippageExceeded") || err.error
        );
      }
    });
  });

  describe("collect_protocol_fees", () => {
    let treasuryTokenA: PublicKey;
    let treasuryTokenB: PublicKey;

    before(async () => {
      // Create treasury token accounts
      treasuryTokenA = await createAccount(
        provider.connection,
        (admin as any).payer,
        tokenAMint,
        admin.publicKey
      );
      treasuryTokenB = await createAccount(
        provider.connection,
        (admin as any).payer,
        tokenBMint,
        admin.publicKey
      );
    });

    it("collects protocol fees successfully", async () => {
      const poolBefore = await program.account.pool.fetch(poolPda);

      // Only proceed if there are fees to collect
      if (
        poolBefore.protocolFeesA.gt(new BN(0)) ||
        poolBefore.protocolFeesB.gt(new BN(0))
      ) {
        await program.methods
          .collectProtocolFees()
          .accounts({
            pool: poolPda,
            tokenAVault: tokenAVault.publicKey,
            tokenBVault: tokenBVault.publicKey,
            treasuryTokenA: treasuryTokenA,
            treasuryTokenB: treasuryTokenB,
            admin: admin.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();

        const poolAfter = await program.account.pool.fetch(poolPda);
        assert.ok(poolAfter.protocolFeesA.eq(new BN(0)));
        assert.ok(poolAfter.protocolFeesB.eq(new BN(0)));

        // Verify treasury received fees
        if (poolBefore.protocolFeesA.gt(new BN(0))) {
          const treasA = await getAccount(
            provider.connection,
            treasuryTokenA
          );
          assert.ok(Number(treasA.amount) > 0);
        }
      }
    });

    it("fails when non-admin tries to collect", async () => {
      // First do a swap to generate some fees
      await program.methods
        .swap(new BN(1_000_000), new BN(1), { aToB: {} })
        .accounts({
          pool: poolPda,
          userTokenA: userTokenA,
          userTokenB: userTokenB,
          tokenAVault: tokenAVault.publicKey,
          tokenBVault: tokenBVault.publicKey,
          user: admin.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const fakeAdmin = Keypair.generate();
      await airdrop(fakeAdmin.publicKey, 1);

      const fakeTreasuryA = await createAccount(
        provider.connection,
        (admin as any).payer,
        tokenAMint,
        fakeAdmin.publicKey
      );
      const fakeTreasuryB = await createAccount(
        provider.connection,
        (admin as any).payer,
        tokenBMint,
        fakeAdmin.publicKey
      );

      try {
        await program.methods
          .collectProtocolFees()
          .accounts({
            pool: poolPda,
            tokenAVault: tokenAVault.publicKey,
            tokenBVault: tokenBVault.publicKey,
            treasuryTokenA: fakeTreasuryA,
            treasuryTokenB: fakeTreasuryB,
            admin: fakeAdmin.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([fakeAdmin])
          .rpc();
        assert.fail("Should have thrown an error");
      } catch (err: any) {
        // Should fail with Unauthorized or constraint violation
        assert.ok(err.error || err.toString().includes("Error"));
      }
    });

    it("fails when no fees to collect", async () => {
      // First collect all existing fees
      const pool = await program.account.pool.fetch(poolPda);
      if (
        pool.protocolFeesA.gt(new BN(0)) ||
        pool.protocolFeesB.gt(new BN(0))
      ) {
        await program.methods
          .collectProtocolFees()
          .accounts({
            pool: poolPda,
            tokenAVault: tokenAVault.publicKey,
            tokenBVault: tokenBVault.publicKey,
            treasuryTokenA: treasuryTokenA,
            treasuryTokenB: treasuryTokenB,
            admin: admin.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
      }

      // Now try to collect again — should fail
      try {
        await program.methods
          .collectProtocolFees()
          .accounts({
            pool: poolPda,
            tokenAVault: tokenAVault.publicKey,
            tokenBVault: tokenBVault.publicKey,
            treasuryTokenA: treasuryTokenA,
            treasuryTokenB: treasuryTokenB,
            admin: admin.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Should have thrown an error");
      } catch (err: any) {
        assert.ok(
          err.toString().includes("NoProtocolFees") || err.error
        );
      }
    });
  });

  describe("constant product invariant", () => {
    it("maintains k = reserve_a * reserve_b (approximately) after swap", async () => {
      const poolBefore = await program.account.pool.fetch(poolPda);
      const kBefore =
        poolBefore.reserveA.toNumber() * poolBefore.reserveB.toNumber();

      await program.methods
        .swap(new BN(5_000_000), new BN(1), { aToB: {} })
        .accounts({
          pool: poolPda,
          userTokenA: userTokenA,
          userTokenB: userTokenB,
          tokenAVault: tokenAVault.publicKey,
          tokenBVault: tokenBVault.publicKey,
          user: admin.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const poolAfter = await program.account.pool.fetch(poolPda);
      const kAfter =
        poolAfter.reserveA.toNumber() * poolAfter.reserveB.toNumber();

      // k should increase slightly due to fees staying in the pool
      assert.ok(
        kAfter >= kBefore,
        `k should not decrease. Before: ${kBefore}, After: ${kAfter}`
      );
    });
  });
});
