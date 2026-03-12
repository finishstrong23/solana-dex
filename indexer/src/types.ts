export interface SwapRecord {
  id: number;
  signature: string;
  pool_address: string;
  user_address: string;
  token_in_mint: string;
  token_out_mint: string;
  amount_in: bigint;
  amount_out: bigint;
  fee_amount: bigint;
  price: number;
  slot: bigint;
  block_time: number;
  created_at: string;
}

export interface LiquidityEventRecord {
  id: number;
  signature: string;
  pool_address: string;
  user_address: string;
  event_type: string;
  amount_a: bigint;
  amount_b: bigint;
  lp_tokens: bigint;
  slot: bigint;
  block_time: number;
  created_at: string;
}

export interface CandleRecord {
  id: number;
  pool_address: string;
  interval: CandleInterval;
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trade_count: number;
}

export interface PoolSnapshotRecord {
  id: number;
  pool_address: string;
  reserve_a: bigint;
  reserve_b: bigint;
  tvl_usd: number | null;
  timestamp: number;
}

export type CandleInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export interface ParsedSwapEvent {
  type: 'SwapExecuted';
  pool: string;
  user: string;
  tokenInMint: string;
  tokenOutMint: string;
  amountIn: bigint;
  amountOut: bigint;
  feeAmount: bigint;
  reserveAAfter: bigint;
  reserveBAfter: bigint;
}

export interface ParsedLiquidityAddedEvent {
  type: 'LiquidityAdded';
  pool: string;
  user: string;
  amountA: bigint;
  amountB: bigint;
  lpTokensMinted: bigint;
}

export interface ParsedLiquidityRemovedEvent {
  type: 'LiquidityRemoved';
  pool: string;
  user: string;
  amountA: bigint;
  amountB: bigint;
  lpTokensBurned: bigint;
}

export type ParsedEvent =
  | ParsedSwapEvent
  | ParsedLiquidityAddedEvent
  | ParsedLiquidityRemovedEvent;

export interface PoolStats {
  address: string;
  reserve_a: string;
  reserve_b: string;
  volume_24h: string;
  fees_24h: string;
  trade_count_24h: number;
  current_price: number | null;
}

export interface ProtocolStats {
  total_tvl: number;
  total_24h_volume: string;
  total_24h_fees: string;
  total_pools: number;
  total_swaps: number;
}
