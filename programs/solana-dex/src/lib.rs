use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod solana_dex {
    use super::*;

    /// Initialize a new liquidity pool for a token pair
    pub fn initialize_pool(ctx: Context<InitializePool>, fee_rate: u16) -> Result<()> {
        instructions::initialize_pool::handler(ctx, fee_rate)
    }

    /// Add liquidity to an existing pool
    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        amount_a: u64,
        amount_b: u64,
        min_lp_tokens: u64,
    ) -> Result<()> {
        instructions::add_liquidity::handler(ctx, amount_a, amount_b, min_lp_tokens)
    }

    /// Remove liquidity from a pool
    pub fn remove_liquidity(
        ctx: Context<RemoveLiquidity>,
        lp_token_amount: u64,
        min_a_out: u64,
        min_b_out: u64,
    ) -> Result<()> {
        instructions::remove_liquidity::handler(ctx, lp_token_amount, min_a_out, min_b_out)
    }

    /// Execute a token swap
    pub fn swap(
        ctx: Context<Swap>,
        amount_in: u64,
        min_amount_out: u64,
        swap_direction: SwapDirection,
    ) -> Result<()> {
        instructions::swap::handler(ctx, amount_in, min_amount_out, swap_direction)
    }

    /// Collect accumulated protocol fees (admin only)
    pub fn collect_protocol_fees(ctx: Context<CollectProtocolFees>) -> Result<()> {
        instructions::collect_fees::handler(ctx)
    }
}
