import { createHash } from 'crypto';
import bs58 from 'bs58';
import type { ParsedEvent, ParsedSwapEvent, ParsedLiquidityAddedEvent, ParsedLiquidityRemovedEvent } from './types';

/**
 * Compute the Anchor event discriminator for a given event name.
 * Anchor uses the first 8 bytes of SHA-256("event:<EventName>").
 */
function eventDiscriminator(eventName: string): Buffer {
  const hash = createHash('sha256').update(`event:${eventName}`).digest();
  return hash.subarray(0, 8);
}

const SWAP_EXECUTED_DISC = eventDiscriminator('SwapExecuted');
const LIQUIDITY_ADDED_DISC = eventDiscriminator('LiquidityAdded');
const LIQUIDITY_REMOVED_DISC = eventDiscriminator('LiquidityRemoved');

/**
 * Read a 32-byte public key from a buffer at the given offset
 * and return it as a base58 string.
 */
function readPubkey(buf: Buffer, offset: number): string {
  const keyBytes = buf.subarray(offset, offset + 32);
  return bs58.encode(keyBytes);
}

/**
 * Read an unsigned 64-bit integer (little-endian) from a buffer.
 */
function readU64(buf: Buffer, offset: number): bigint {
  return buf.readBigUInt64LE(offset);
}

/**
 * Read a signed 64-bit integer (little-endian) from a buffer.
 */
function readI64(buf: Buffer, offset: number): bigint {
  return buf.readBigInt64LE(offset);
}

/**
 * Decode a SwapExecuted event from borsh-serialized data.
 *
 * Layout (after 8-byte discriminator):
 *   pool:            Pubkey (32 bytes)
 *   user:            Pubkey (32 bytes)
 *   token_in_mint:   Pubkey (32 bytes)
 *   token_out_mint:  Pubkey (32 bytes)
 *   amount_in:       u64   (8 bytes)
 *   amount_out:      u64   (8 bytes)
 *   fee_amount:      u64   (8 bytes)
 *   reserve_a_after: u64   (8 bytes)
 *   reserve_b_after: u64   (8 bytes)
 */
function decodeSwapExecuted(data: Buffer): ParsedSwapEvent {
  let offset = 8; // skip discriminator

  const pool = readPubkey(data, offset); offset += 32;
  const user = readPubkey(data, offset); offset += 32;
  const tokenInMint = readPubkey(data, offset); offset += 32;
  const tokenOutMint = readPubkey(data, offset); offset += 32;
  const amountIn = readU64(data, offset); offset += 8;
  const amountOut = readU64(data, offset); offset += 8;
  const feeAmount = readU64(data, offset); offset += 8;
  const reserveAAfter = readU64(data, offset); offset += 8;
  const reserveBAfter = readU64(data, offset);

  return {
    type: 'SwapExecuted',
    pool,
    user,
    tokenInMint,
    tokenOutMint,
    amountIn,
    amountOut,
    feeAmount,
    reserveAAfter,
    reserveBAfter,
  };
}

/**
 * Decode a LiquidityAdded event from borsh-serialized data.
 *
 * Layout (after 8-byte discriminator):
 *   pool:             Pubkey (32 bytes)
 *   user:             Pubkey (32 bytes)
 *   amount_a:         u64   (8 bytes)
 *   amount_b:         u64   (8 bytes)
 *   lp_tokens_minted: u64   (8 bytes)
 */
function decodeLiquidityAdded(data: Buffer): ParsedLiquidityAddedEvent {
  let offset = 8;

  const pool = readPubkey(data, offset); offset += 32;
  const user = readPubkey(data, offset); offset += 32;
  const amountA = readU64(data, offset); offset += 8;
  const amountB = readU64(data, offset); offset += 8;
  const lpTokensMinted = readU64(data, offset);

  return {
    type: 'LiquidityAdded',
    pool,
    user,
    amountA,
    amountB,
    lpTokensMinted,
  };
}

/**
 * Decode a LiquidityRemoved event from borsh-serialized data.
 *
 * Layout (after 8-byte discriminator):
 *   pool:             Pubkey (32 bytes)
 *   user:             Pubkey (32 bytes)
 *   amount_a:         u64   (8 bytes)
 *   amount_b:         u64   (8 bytes)
 *   lp_tokens_burned: u64   (8 bytes)
 */
function decodeLiquidityRemoved(data: Buffer): ParsedLiquidityRemovedEvent {
  let offset = 8;

  const pool = readPubkey(data, offset); offset += 32;
  const user = readPubkey(data, offset); offset += 32;
  const amountA = readU64(data, offset); offset += 8;
  const amountB = readU64(data, offset); offset += 8;
  const lpTokensBurned = readU64(data, offset);

  return {
    type: 'LiquidityRemoved',
    pool,
    user,
    amountA,
    amountB,
    lpTokensBurned,
  };
}

/**
 * Parse transaction logs to extract Anchor events.
 *
 * Anchor emits events as base64-encoded data in "Program data:" log entries.
 * Each entry contains the 8-byte discriminator followed by borsh-serialized fields.
 */
export function parseTransactionLogs(logs: string[]): ParsedEvent[] {
  const events: ParsedEvent[] = [];

  for (const log of logs) {
    if (!log.startsWith('Program data: ')) {
      continue;
    }

    const base64Data = log.slice('Program data: '.length).trim();

    let data: Buffer;
    try {
      data = Buffer.from(base64Data, 'base64');
    } catch (err) {
      console.warn('[Parser] Failed to decode base64 log entry:', err);
      continue;
    }

    if (data.length < 8) {
      continue;
    }

    const discriminator = data.subarray(0, 8);

    try {
      if (discriminator.equals(SWAP_EXECUTED_DISC)) {
        events.push(decodeSwapExecuted(data));
      } else if (discriminator.equals(LIQUIDITY_ADDED_DISC)) {
        events.push(decodeLiquidityAdded(data));
      } else if (discriminator.equals(LIQUIDITY_REMOVED_DISC)) {
        events.push(decodeLiquidityRemoved(data));
      }
    } catch (err) {
      console.warn('[Parser] Failed to decode event data:', err);
    }
  }

  return events;
}
