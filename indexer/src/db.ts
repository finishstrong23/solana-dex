import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { CandleInterval, PoolStats, ProtocolStats } from './types';

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'dex.db');

export function initDatabase(): Database.Database {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read/write performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS swaps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signature TEXT UNIQUE NOT NULL,
      pool_address TEXT NOT NULL,
      user_address TEXT NOT NULL,
      token_in_mint TEXT NOT NULL,
      token_out_mint TEXT NOT NULL,
      amount_in BIGINT NOT NULL,
      amount_out BIGINT NOT NULL,
      fee_amount BIGINT NOT NULL,
      price REAL NOT NULL,
      slot BIGINT NOT NULL,
      block_time INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS liquidity_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signature TEXT UNIQUE NOT NULL,
      pool_address TEXT NOT NULL,
      user_address TEXT NOT NULL,
      event_type TEXT NOT NULL,
      amount_a BIGINT NOT NULL,
      amount_b BIGINT NOT NULL,
      lp_tokens BIGINT NOT NULL,
      slot BIGINT NOT NULL,
      block_time INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS candles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pool_address TEXT NOT NULL,
      interval TEXT NOT NULL,
      open_time INTEGER NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume REAL NOT NULL,
      trade_count INTEGER NOT NULL,
      UNIQUE(pool_address, interval, open_time)
    );

    CREATE TABLE IF NOT EXISTS pool_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pool_address TEXT NOT NULL,
      reserve_a BIGINT NOT NULL,
      reserve_b BIGINT NOT NULL,
      tvl_usd REAL,
      timestamp INTEGER NOT NULL,
      UNIQUE(pool_address, timestamp)
    );

    CREATE INDEX IF NOT EXISTS idx_swaps_pool ON swaps(pool_address, block_time);
    CREATE INDEX IF NOT EXISTS idx_swaps_user ON swaps(user_address, block_time);
    CREATE INDEX IF NOT EXISTS idx_candles_lookup ON candles(pool_address, interval, open_time);
    CREATE INDEX IF NOT EXISTS idx_snapshots_pool ON pool_snapshots(pool_address, timestamp);
  `);

  console.log('[DB] Database initialized at', DB_PATH);
  return db;
}

// --- Prepared statement functions ---

export function insertSwap(
  db: Database.Database,
  params: {
    signature: string;
    pool_address: string;
    user_address: string;
    token_in_mint: string;
    token_out_mint: string;
    amount_in: string;
    amount_out: string;
    fee_amount: string;
    price: number;
    slot: string;
    block_time: number;
  }
): Database.RunResult {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO swaps
      (signature, pool_address, user_address, token_in_mint, token_out_mint,
       amount_in, amount_out, fee_amount, price, slot, block_time)
    VALUES
      (@signature, @pool_address, @user_address, @token_in_mint, @token_out_mint,
       @amount_in, @amount_out, @fee_amount, @price, @slot, @block_time)
  `);
  return stmt.run(params);
}

export function insertLiquidityEvent(
  db: Database.Database,
  params: {
    signature: string;
    pool_address: string;
    user_address: string;
    event_type: string;
    amount_a: string;
    amount_b: string;
    lp_tokens: string;
    slot: string;
    block_time: number;
  }
): Database.RunResult {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO liquidity_events
      (signature, pool_address, user_address, event_type, amount_a, amount_b,
       lp_tokens, slot, block_time)
    VALUES
      (@signature, @pool_address, @user_address, @event_type, @amount_a, @amount_b,
       @lp_tokens, @slot, @block_time)
  `);
  return stmt.run(params);
}

export function upsertCandle(
  db: Database.Database,
  params: {
    pool_address: string;
    interval: string;
    open_time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    trade_count: number;
  }
): Database.RunResult {
  const stmt = db.prepare(`
    INSERT INTO candles
      (pool_address, interval, open_time, open, high, low, close, volume, trade_count)
    VALUES
      (@pool_address, @interval, @open_time, @open, @high, @low, @close, @volume, @trade_count)
    ON CONFLICT(pool_address, interval, open_time) DO UPDATE SET
      high = MAX(candles.high, @high),
      low = MIN(candles.low, @low),
      close = @close,
      volume = candles.volume + @volume,
      trade_count = candles.trade_count + @trade_count
  `);
  return stmt.run(params);
}

export function insertPoolSnapshot(
  db: Database.Database,
  params: {
    pool_address: string;
    reserve_a: string;
    reserve_b: string;
    tvl_usd: number | null;
    timestamp: number;
  }
): Database.RunResult {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO pool_snapshots
      (pool_address, reserve_a, reserve_b, tvl_usd, timestamp)
    VALUES
      (@pool_address, @reserve_a, @reserve_b, @tvl_usd, @timestamp)
  `);
  return stmt.run(params);
}

export function getSwapsByPool(
  db: Database.Database,
  poolAddress: string,
  limit: number = 50,
  offset: number = 0
): unknown[] {
  const stmt = db.prepare(`
    SELECT * FROM swaps
    WHERE pool_address = ?
    ORDER BY block_time DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(poolAddress, limit, offset);
}

export function getSwapsByUser(
  db: Database.Database,
  userAddress: string,
  limit: number = 50,
  offset: number = 0
): unknown[] {
  const stmt = db.prepare(`
    SELECT * FROM swaps
    WHERE user_address = ?
    ORDER BY block_time DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(userAddress, limit, offset);
}

export function getCandles(
  db: Database.Database,
  poolAddress: string,
  interval: CandleInterval,
  from: number,
  to: number
): unknown[] {
  const stmt = db.prepare(`
    SELECT * FROM candles
    WHERE pool_address = ?
      AND interval = ?
      AND open_time >= ?
      AND open_time <= ?
    ORDER BY open_time ASC
  `);
  return stmt.all(poolAddress, interval, from, to);
}

export function getPoolStats(
  db: Database.Database,
  poolAddress: string
): PoolStats | null {
  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - 86400;

  const stmt = db.prepare(`
    SELECT
      ? AS address,
      COALESCE(
        (SELECT reserve_a FROM pool_snapshots
         WHERE pool_address = ? ORDER BY timestamp DESC LIMIT 1),
        '0'
      ) AS reserve_a,
      COALESCE(
        (SELECT reserve_b FROM pool_snapshots
         WHERE pool_address = ? ORDER BY timestamp DESC LIMIT 1),
        '0'
      ) AS reserve_b,
      COALESCE(
        (SELECT CAST(SUM(amount_in) AS TEXT) FROM swaps
         WHERE pool_address = ? AND block_time >= ?),
        '0'
      ) AS volume_24h,
      COALESCE(
        (SELECT CAST(SUM(fee_amount) AS TEXT) FROM swaps
         WHERE pool_address = ? AND block_time >= ?),
        '0'
      ) AS fees_24h,
      COALESCE(
        (SELECT COUNT(*) FROM swaps
         WHERE pool_address = ? AND block_time >= ?),
        0
      ) AS trade_count_24h,
      (SELECT price FROM swaps
       WHERE pool_address = ? ORDER BY block_time DESC LIMIT 1
      ) AS current_price
  `);

  const row = stmt.get(
    poolAddress,
    poolAddress,
    poolAddress,
    poolAddress, oneDayAgo,
    poolAddress, oneDayAgo,
    poolAddress, oneDayAgo,
    poolAddress
  ) as PoolStats | undefined;

  return row ?? null;
}

export function getAllPoolStats(db: Database.Database): PoolStats[] {
  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - 86400;

  // Get all distinct pool addresses
  const poolsStmt = db.prepare(`
    SELECT DISTINCT pool_address FROM (
      SELECT pool_address FROM swaps
      UNION
      SELECT pool_address FROM pool_snapshots
    )
  `);
  const pools = poolsStmt.all() as { pool_address: string }[];

  const results: PoolStats[] = [];
  for (const pool of pools) {
    const stats = getPoolStats(db, pool.pool_address);
    if (stats) {
      results.push(stats);
    }
  }

  return results;
}

export function getProtocolStats(db: Database.Database): ProtocolStats {
  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - 86400;

  const stmt = db.prepare(`
    SELECT
      COALESCE(
        (SELECT SUM(tvl_usd) FROM pool_snapshots ps1
         WHERE timestamp = (
           SELECT MAX(timestamp) FROM pool_snapshots ps2
           WHERE ps2.pool_address = ps1.pool_address
         )),
        0
      ) AS total_tvl,
      COALESCE(
        (SELECT CAST(SUM(amount_in) AS TEXT) FROM swaps WHERE block_time >= ?),
        '0'
      ) AS total_24h_volume,
      COALESCE(
        (SELECT CAST(SUM(fee_amount) AS TEXT) FROM swaps WHERE block_time >= ?),
        '0'
      ) AS total_24h_fees,
      (SELECT COUNT(DISTINCT pool_address) FROM pool_snapshots) AS total_pools,
      (SELECT COUNT(*) FROM swaps) AS total_swaps
  `);

  const row = stmt.get(oneDayAgo, oneDayAgo) as ProtocolStats | undefined;

  return row ?? {
    total_tvl: 0,
    total_24h_volume: '0',
    total_24h_fees: '0',
    total_pools: 0,
    total_swaps: 0,
  };
}
