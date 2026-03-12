import type Database from 'better-sqlite3';
import type { CandleInterval } from './types';

export const INTERVALS: Record<CandleInterval, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
};

/**
 * Update OHLCV candles for all intervals after a swap event.
 *
 * For each interval, the block time is bucketed to the interval boundary.
 * If a candle already exists for that bucket, high/low/close/volume/trade_count
 * are updated. Otherwise, a new candle is inserted.
 */
export function updateCandles(
  db: Database.Database,
  poolAddress: string,
  price: number,
  volume: number,
  blockTime: number
): void {
  const getStmt = db.prepare(`
    SELECT id, high, low FROM candles
    WHERE pool_address = ? AND interval = ? AND open_time = ?
  `);

  const insertStmt = db.prepare(`
    INSERT INTO candles
      (pool_address, interval, open_time, open, high, low, close, volume, trade_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const updateStmt = db.prepare(`
    UPDATE candles SET
      high = MAX(high, ?),
      low = MIN(low, ?),
      close = ?,
      volume = volume + ?,
      trade_count = trade_count + 1
    WHERE pool_address = ? AND interval = ? AND open_time = ?
  `);

  for (const [interval, seconds] of Object.entries(INTERVALS)) {
    const openTime = Math.floor(blockTime / seconds) * seconds;

    const existing = getStmt.get(poolAddress, interval, openTime) as
      | { id: number; high: number; low: number }
      | undefined;

    if (existing) {
      updateStmt.run(
        price,
        price,
        price,
        volume,
        poolAddress,
        interval,
        openTime
      );
    } else {
      insertStmt.run(
        poolAddress,
        interval,
        openTime,
        price,
        price,
        price,
        price,
        volume
      );
    }
  }
}
