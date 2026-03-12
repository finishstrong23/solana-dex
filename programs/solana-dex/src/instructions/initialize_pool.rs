use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

use crate::errors::DexError;
use crate::events::PoolInitialized;
use crate::state::Pool;

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = admin,
        space = Pool::LEN,
        seeds = [
            Pool::SEED_PREFIX,
            token_a_mint.key().as_ref(),
            token_b_mint.key().as_ref(),
        ],
        bump,
    )]
    pub pool: Account<'info, Pool>,

    /// The mint for token A
    pub token_a_mint: Account<'info, Mint>,

    /// The mint for token B
    pub token_b_mint: Account<'info, Mint>,

    /// Token account (vault) for holding token A reserves
    #[account(
        init,
        payer = admin,
        token::mint = token_a_mint,
        token::authority = pool,
    )]
    pub token_a_vault: Account<'info, TokenAccount>,

    /// Token account (vault) for holding token B reserves
    #[account(
        init,
        payer = admin,
        token::mint = token_b_mint,
        token::authority = pool,
    )]
    pub token_b_vault: Account<'info, TokenAccount>,

    /// LP token mint - pool PDA is the mint authority
    #[account(
        init,
        payer = admin,
        mint::decimals = 6,
        mint::authority = pool,
    )]
    pub lp_mint: Account<'info, Mint>,

    /// The admin/creator of the pool
    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<InitializePool>, fee_rate: u16) -> Result<()> {
    // Validate fee rate (1-1000 basis points = 0.01% - 10%)
    require!(fee_rate >= 1 && fee_rate <= 1000, DexError::InvalidFeeRate);

    // Ensure mints are different
    require!(
        ctx.accounts.token_a_mint.key() != ctx.accounts.token_b_mint.key(),
        DexError::IdenticalMints
    );

    let pool = &mut ctx.accounts.pool;
    pool.token_a_mint = ctx.accounts.token_a_mint.key();
    pool.token_b_mint = ctx.accounts.token_b_mint.key();
    pool.token_a_vault = ctx.accounts.token_a_vault.key();
    pool.token_b_vault = ctx.accounts.token_b_vault.key();
    pool.lp_mint = ctx.accounts.lp_mint.key();
    pool.fee_rate = fee_rate;
    pool.protocol_fee_rate = Pool::PROTOCOL_FEE_RATE;
    pool.reserve_a = 0;
    pool.reserve_b = 0;
    pool.protocol_fees_a = 0;
    pool.protocol_fees_b = 0;
    pool.admin = ctx.accounts.admin.key();
    pool.bump = ctx.bumps.pool;
    pool.total_lp_supply = 0;

    emit!(PoolInitialized {
        pool: pool.key(),
        token_a_mint: pool.token_a_mint,
        token_b_mint: pool.token_b_mint,
        fee_rate,
        admin: pool.admin,
    });

    Ok(())
}
