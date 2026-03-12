import express, { Request, Response } from 'express';
import cors from 'cors';
import type Database from 'better-sqlite3';
import {
  getSwapsByPool,
  getSwapsByUser,
  getCandles,
  getPoolStats,
  getAllPoolStats,
  getProtocolStats,
} from './db';
import type { CandleInterval } from './types';

const VALID_INTERVALS: CandleInterval[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

/**
 * Create and configure the Express API server.
 */
export function createApiServer(db: Database.Database): express.Express {
  const app = express();

  app.use(cors({ origin: '*' }));
  app.use(express.json());

  // GET /api/swaps?pool=<address>&limit=50&offset=0
  app.get('/api/swaps', (req: Request, res: Response) => {
    try {
      const pool = req.query.pool as string | undefined;
      if (!pool) {
        res.status(400).json({ error: 'Missing required query parameter: pool' });
        return;
      }

      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 500);
      const offset = parseInt(req.query.offset as string, 10) || 0;

      const swaps = getSwapsByPool(db, pool, limit, offset);
      res.json({ data: swaps, limit, offset });
    } catch (err) {
      console.error('[API] Error in GET /api/swaps:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/swaps/user?address=<wallet>&limit=50&offset=0
  app.get('/api/swaps/user', (req: Request, res: Response) => {
    try {
      const address = req.query.address as string | undefined;
      if (!address) {
        res.status(400).json({ error: 'Missing required query parameter: address' });
        return;
      }

      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 500);
      const offset = parseInt(req.query.offset as string, 10) || 0;

      const swaps = getSwapsByUser(db, address, limit, offset);
      res.json({ data: swaps, limit, offset });
    } catch (err) {
      console.error('[API] Error in GET /api/swaps/user:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/candles?pool=<address>&interval=1h&from=<timestamp>&to=<timestamp>
  app.get('/api/candles', (req: Request, res: Response) => {
    try {
      const pool = req.query.pool as string | undefined;
      const interval = req.query.interval as CandleInterval | undefined;

      if (!pool) {
        res.status(400).json({ error: 'Missing required query parameter: pool' });
        return;
      }

      if (!interval || !VALID_INTERVALS.includes(interval)) {
        res.status(400).json({
          error: `Invalid interval. Must be one of: ${VALID_INTERVALS.join(', ')}`,
        });
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const from = parseInt(req.query.from as string, 10) || now - 86400;
      const to = parseInt(req.query.to as string, 10) || now;

      const candles = getCandles(db, pool, interval, from, to);

      // Transform to lightweight format for charting
      const formatted = (candles as Array<{
        open_time: number;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
      }>).map((c) => ({
        time: c.open_time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));

      res.json({ data: formatted, pool, interval, from, to });
    } catch (err) {
      console.error('[API] Error in GET /api/candles:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/pools/stats
  app.get('/api/pools/stats', (_req: Request, res: Response) => {
    try {
      const stats = getAllPoolStats(db);
      res.json({ data: stats });
    } catch (err) {
      console.error('[API] Error in GET /api/pools/stats:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/pools/:address/stats
  app.get('/api/pools/:address/stats', (req: Request, res: Response) => {
    try {
      const { address } = req.params;

      const stats = getPoolStats(db, address);
      if (!stats) {
        res.status(404).json({ error: 'Pool not found' });
        return;
      }

      // Calculate 7d volume
      const now = Math.floor(Date.now() / 1000);
      const sevenDaysAgo = now - 7 * 86400;
      const oneDayAgo = now - 86400;

      const volume7dStmt = db.prepare(`
        SELECT COALESCE(CAST(SUM(amount_in) AS TEXT), '0') AS volume_7d
        FROM swaps WHERE pool_address = ? AND block_time >= ?
      `);
      const volume7dRow = volume7dStmt.get(address, sevenDaysAgo) as { volume_7d: string };

      // Calculate 24h price change
      const priceChangeStmt = db.prepare(`
        SELECT price FROM swaps
        WHERE pool_address = ? AND block_time <= ?
        ORDER BY block_time DESC LIMIT 1
      `);
      const priceRow24hAgo = priceChangeStmt.get(address, oneDayAgo) as { price: number } | undefined;

      let priceChange24h: number | null = null;
      if (priceRow24hAgo && stats.current_price) {
        const oldPrice = priceRow24hAgo.price;
        if (oldPrice > 0) {
          priceChange24h = ((stats.current_price - oldPrice) / oldPrice) * 100;
        }
      }

      res.json({
        data: {
          ...stats,
          volume_7d: volume7dRow.volume_7d,
          price_change_24h: priceChange24h,
        },
      });
    } catch (err) {
      console.error('[API] Error in GET /api/pools/:address/stats:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/protocol/stats
  app.get('/api/protocol/stats', (_req: Request, res: Response) => {
    try {
      const stats = getProtocolStats(db);
      res.json({ data: stats });
    } catch (err) {
      console.error('[API] Error in GET /api/protocol/stats:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}
