use anchor_lang::prelude::*;

#[event]
pub struct PoolInitialized {
    pub pool: Pubkey,
    pub token_a_mint: Pubkey,
    pub token_b_mint: Pubkey,
    pub fee_rate: u16,
    pub admin: Pubkey,
}

#[event]
pub struct LiquidityAdded {
    pub pool: Pubkey,
    pub user: Pubkey,
    pub amount_a: u64,
    pub amount_b: u64,
    pub lp_tokens_minted: u64,
    pub timestamp: i64,
}

#[event]
pub struct LiquidityRemoved {
    pub pool: Pubkey,
    pub user: Pubkey,
    pub amount_a: u64,
    pub amount_b: u64,
    pub lp_tokens_burned: u64,
    pub timestamp: i64,
}

#[event]
pub struct SwapExecuted {
    pub pool: Pubkey,
    pub user: Pubkey,
    pub token_in_mint: Pubkey,
    pub token_out_mint: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,
    pub fee: u64,
    pub reserve_a_after: u64,
    pub reserve_b_after: u64,
    pub swap_direction: u8,
    pub timestamp: i64,
}

#[event]
pub struct ProtocolFeesCollected {
    pub pool: Pubkey,
    pub amount_a: u64,
    pub amount_b: u64,
    pub treasury: Pubkey,
}
