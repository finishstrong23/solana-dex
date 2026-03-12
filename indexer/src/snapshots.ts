import { Connection, PublicKey } from '@solana/web3.js';
import type Database from 'better-sqlite3';
import { insertPoolSnapshot } from './db';

const SNAPSHOT_INTERVAL_MS = 60_000; // 60 seconds

/**
 * Decode pool account data to extract reserves.
 *
 * Expected Anchor account layout (after 8-byte discriminator):
 *   authority:    Pubkey (32 bytes)
 *   token_mint_a: Pubkey (32 bytes)
 *   token_mint_b: Pubkey (32 bytes)
 *   token_vault_a: Pubkey (32 bytes)
 *   token_vault_b: Pubkey (32 bytes)
 *   lp_mint:      Pubkey (32 bytes)
 *   reserve_a:    u64   (8 bytes)
 *   reserve_b:    u64   (8 bytes)
 *   ...
 */
function decodePoolReserves(data: Buffer): { reserveA: bigint; reserveB: bigint } | null {
  // 8 (discriminator) + 6 * 32 (pubkeys) = 200 bytes before reserves
  const RESERVES_OFFSET = 8 + 6 * 32;

  if (data.length < RESERVES_OFFSET + 16) {
    return null;
  }

  const reserveA = data.readBigUInt64LE(RESERVES_OFFSET);
  const reserveB = data.readBigUInt64LE(RESERVES_OFFSET + 8);

  return { reserveA, reserveB };
}

/**
 * Fetch all pool accounts from the program and store snapshots.
 */
async function takeSnapshots(
  connection: Connection,
  programId: PublicKey,
  db: Database.Database
): Promise<void> {
  try {
    // Fetch all accounts owned by the program
    // Filter by data size to find pool accounts (adjust size as needed)
    const accounts = await connection.getProgramAccounts(programId, {
      commitment: 'confirmed',
    });

    const timestamp = Math.floor(Date.now() / 1000);
    let snapshotCount = 0;

    for (const { pubkey, account } of accounts) {
      const data = Buffer.from(account.data);

      // Skip accounts that are too small to be pool accounts
      if (data.length < 216) {
        continue;
      }

      const reserves = decodePoolReserves(data);
      if (!reserves) {
        continue;
      }

      // Skip accounts with zero reserves (likely not pool accounts)
      if (reserves.reserveA === 0n && reserves.reserveB === 0n) {
        continue;
      }

      try {
        insertPoolSnapshot(db, {
          pool_address: pubkey.toBase58(),
          reserve_a: reserves.reserveA.toString(),
          reserve_b: reserves.reserveB.toString(),
          tvl_usd: null, // TODO: integrate price oracle for USD valuation
          timestamp,
        });
        snapshotCount++;
      } catch (err) {
        console.error(`[Snapshots] Error inserting snapshot for ${pubkey.toBase58()}:`, err);
      }
    }

    if (snapshotCount > 0) {
      console.log(`[Snapshots] Stored ${snapshotCount} pool snapshot(s) at ${new Date(timestamp * 1000).toISOString()}`);
    }
  } catch (err) {
    console.error('[Snapshots] Error fetching pool accounts:', err);
  }
}

/**
 * Start the periodic snapshot job.
 * Takes a snapshot of all pool accounts every 60 seconds.
 */
export function startSnapshotJob(
  connection: Connection,
  programId: PublicKey,
  db: Database.Database
): NodeJS.Timeout {
  console.log(`[Snapshots] Starting snapshot job (interval: ${SNAPSHOT_INTERVAL_MS / 1000}s)`);

  // Take an initial snapshot immediately
  takeSnapshots(connection, programId, db).catch((err) => {
    console.error('[Snapshots] Error during initial snapshot:', err);
  });

  // Schedule periodic snapshots
  const intervalId = setInterval(() => {
    takeSnapshots(connection, programId, db).catch((err) => {
      console.error('[Snapshots] Error during scheduled snapshot:', err);
    });
  }, SNAPSHOT_INTERVAL_MS);

  return intervalId;
}
