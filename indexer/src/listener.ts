import {
  Connection,
  PublicKey,
  ConfirmedSignatureInfo,
  ParsedTransactionWithMeta,
} from '@solana/web3.js';
import type Database from 'better-sqlite3';
import { parseTransactionLogs } from './parser';
import { insertSwap, insertLiquidityEvent } from './db';
import { updateCandles } from './candles';
import type { ParsedSwapEvent, ParsedLiquidityAddedEvent, ParsedLiquidityRemovedEvent } from './types';

const BACKFILL_BATCH_SIZE = 100;
const TX_FETCH_DELAY_MS = 200;

/**
 * Process a single parsed swap event: insert into DB and update candles.
 */
function processSwapEvent(
  db: Database.Database,
  event: ParsedSwapEvent,
  signature: string,
  slot: number,
  blockTime: number
): void {
  const reserveA = Number(event.reserveAAfter);
  const reserveB = Number(event.reserveBAfter);
  const price = reserveA > 0 ? reserveB / reserveA : 0;
  const volume = Number(event.amountIn);

  insertSwap(db, {
    signature,
    pool_address: event.pool,
    user_address: event.user,
    token_in_mint: event.tokenInMint,
    token_out_mint: event.tokenOutMint,
    amount_in: event.amountIn.toString(),
    amount_out: event.amountOut.toString(),
    fee_amount: event.feeAmount.toString(),
    price,
    slot: slot.toString(),
    block_time: blockTime,
  });

  updateCandles(db, event.pool, price, volume, blockTime);
}

/**
 * Process a single parsed liquidity event: insert into DB.
 */
function processLiquidityEvent(
  db: Database.Database,
  event: ParsedLiquidityAddedEvent | ParsedLiquidityRemovedEvent,
  signature: string,
  slot: number,
  blockTime: number
): void {
  const eventType = event.type === 'LiquidityAdded' ? 'add' : 'remove';
  const lpTokens =
    event.type === 'LiquidityAdded'
      ? event.lpTokensMinted
      : event.lpTokensBurned;

  insertLiquidityEvent(db, {
    signature,
    pool_address: event.pool,
    user_address: event.user,
    event_type: eventType,
    amount_a: event.amountA.toString(),
    amount_b: event.amountB.toString(),
    lp_tokens: lpTokens.toString(),
    slot: slot.toString(),
    block_time: blockTime,
  });
}

/**
 * Process a transaction: parse its logs and handle any DEX events.
 */
function processTransaction(
  db: Database.Database,
  tx: ParsedTransactionWithMeta,
  signature: string
): number {
  if (!tx.meta?.logMessages) {
    return 0;
  }

  const events = parseTransactionLogs(tx.meta.logMessages);
  if (events.length === 0) {
    return 0;
  }

  const slot = tx.slot;
  const blockTime = tx.blockTime ?? Math.floor(Date.now() / 1000);

  let processed = 0;
  for (const event of events) {
    try {
      if (event.type === 'SwapExecuted') {
        processSwapEvent(db, event, signature, slot, blockTime);
        processed++;
      } else if (event.type === 'LiquidityAdded' || event.type === 'LiquidityRemoved') {
        processLiquidityEvent(db, event, signature, slot, blockTime);
        processed++;
      }
    } catch (err) {
      console.error(`[Listener] Error processing event from tx ${signature}:`, err);
    }
  }

  return processed;
}

/**
 * Backfill historical transactions from the program.
 * Fetches signatures in batches and processes each transaction.
 */
async function backfill(
  connection: Connection,
  programId: PublicKey,
  db: Database.Database
): Promise<void> {
  console.log('[Listener] Starting backfill...');

  let allSignatures: ConfirmedSignatureInfo[] = [];
  let before: string | undefined;
  let batchCount = 0;

  // Fetch all historical signatures in batches
  while (true) {
    const options: { limit: number; before?: string } = {
      limit: BACKFILL_BATCH_SIZE,
    };
    if (before) {
      options.before = before;
    }

    const signatures = await connection.getSignaturesForAddress(programId, options);
    if (signatures.length === 0) {
      break;
    }

    allSignatures = allSignatures.concat(signatures);
    before = signatures[signatures.length - 1].signature;
    batchCount++;

    console.log(`[Listener] Fetched batch ${batchCount}: ${signatures.length} signatures (total: ${allSignatures.length})`);

    // Safety limit to avoid infinite loops during development
    if (allSignatures.length >= 10000) {
      console.log('[Listener] Reached backfill limit of 10,000 signatures');
      break;
    }
  }

  console.log(`[Listener] Processing ${allSignatures.length} historical transactions...`);

  let processedCount = 0;
  let eventCount = 0;

  for (const sigInfo of allSignatures) {
    if (sigInfo.err) {
      continue; // Skip failed transactions
    }

    try {
      const tx = await connection.getParsedTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (tx) {
        const events = processTransaction(db, tx, sigInfo.signature);
        eventCount += events;
      }

      processedCount++;
      if (processedCount % 50 === 0) {
        console.log(`[Listener] Backfill progress: ${processedCount}/${allSignatures.length} txs, ${eventCount} events`);
      }

      // Rate limiting to avoid RPC throttling
      await new Promise((resolve) => setTimeout(resolve, TX_FETCH_DELAY_MS));
    } catch (err) {
      console.error(`[Listener] Error fetching tx ${sigInfo.signature}:`, err);
    }
  }

  console.log(`[Listener] Backfill complete: ${processedCount} txs processed, ${eventCount} events stored`);
}

/**
 * Subscribe to real-time log events from the program via WebSocket.
 */
function subscribe(
  connection: Connection,
  programId: PublicKey,
  db: Database.Database
): number {
  console.log('[Listener] Subscribing to real-time events...');

  const subscriptionId = connection.onLogs(
    programId,
    async (logInfo) => {
      if (logInfo.err) {
        return;
      }

      const events = parseTransactionLogs(logInfo.logs);
      if (events.length === 0) {
        return;
      }

      const signature = logInfo.signature;

      try {
        // Fetch the full transaction to get slot and block time
        const tx = await connection.getParsedTransaction(signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (!tx) {
          console.warn(`[Listener] Could not fetch tx ${signature}`);
          return;
        }

        const count = processTransaction(db, tx, signature);
        if (count > 0) {
          console.log(`[Listener] Processed ${count} event(s) from tx ${signature}`);
        }
      } catch (err) {
        console.error(`[Listener] Error processing real-time tx ${signature}:`, err);
      }
    },
    'confirmed'
  );

  console.log(`[Listener] WebSocket subscription active (id: ${subscriptionId})`);
  return subscriptionId;
}

/**
 * Start the event listener: backfill historical data, then subscribe to real-time events.
 */
export async function startListener(
  connection: Connection,
  programId: PublicKey,
  db: Database.Database
): Promise<number> {
  await backfill(connection, programId, db);
  const subscriptionId = subscribe(connection, programId, db);
  return subscriptionId;
}
