use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};

use crate::errors::DexError;
use crate::events::LiquidityRemoved;
use crate::state::Pool;

#[derive(Accounts)]
pub struct RemoveLiquidity<'info> {
    #[account(
        mut,
        seeds = [
            Pool::SEED_PREFIX,
            pool.token_a_mint.as_ref(),
            pool.token_b_mint.as_ref(),
        ],
        bump = pool.bump,
    )]
    pub pool: Account<'info, Pool>,

    /// User's token A account
    #[account(
        mut,
        constraint = user_token_a.mint == pool.token_a_mint,
    )]
    pub user_token_a: Account<'info, TokenAccount>,

    /// User's token B account
    #[account(
        mut,
        constraint = user_token_b.mint == pool.token_b_mint,
    )]
    pub user_token_b: Account<'info, TokenAccount>,

    /// Pool's token A vault
    #[account(
        mut,
        constraint = token_a_vault.key() == pool.token_a_vault,
    )]
    pub token_a_vault: Account<'info, TokenAccount>,

    /// Pool's token B vault
    #[account(
        mut,
        constraint = token_b_vault.key() == pool.token_b_vault,
    )]
    pub token_b_vault: Account<'info, TokenAccount>,

    /// LP token mint
    #[account(
        mut,
        constraint = lp_mint.key() == pool.lp_mint,
    )]
    pub lp_mint: Account<'info, Mint>,

    /// User's LP token account
    #[account(
        mut,
        constraint = user_lp_token.mint == pool.lp_mint,
    )]
    pub user_lp_token: Account<'info, TokenAccount>,

    /// The user removing liquidity
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<RemoveLiquidity>,
    lp_token_amount: u64,
    min_a_out: u64,
    min_b_out: u64,
) -> Result<()> {
    require!(lp_token_amount > 0, DexError::ZeroAmount);

    let pool = &ctx.accounts.pool;
    let total_lp_supply = pool.total_lp_supply;

    require!(total_lp_supply > 0, DexError::InsufficientLiquidity);

    // Calculate proportional share
    let amount_a = (lp_token_amount as u128)
        .checked_mul(pool.reserve_a as u128)
        .ok_or(DexError::MathOverflow)?
        .checked_div(total_lp_supply as u128)
        .ok_or(DexError::MathOverflow)? as u64;

    let amount_b = (lp_token_amount as u128)
        .checked_mul(pool.reserve_b as u128)
        .ok_or(DexError::MathOverflow)?
        .checked_div(total_lp_supply as u128)
        .ok_or(DexError::MathOverflow)? as u64;

    // Slippage protection
    require!(amount_a >= min_a_out, DexError::SlippageExceeded);
    require!(amount_b >= min_b_out, DexError::SlippageExceeded);

    // Burn LP tokens from user
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.lp_mint.to_account_info(),
                from: ctx.accounts.user_lp_token.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        lp_token_amount,
    )?;

    // Transfer tokens from vaults to user (using pool PDA as authority)
    let token_a_mint = ctx.accounts.pool.token_a_mint;
    let token_b_mint = ctx.accounts.pool.token_b_mint;
    let bump = ctx.accounts.pool.bump;
    let seeds = &[
        Pool::SEED_PREFIX,
        token_a_mint.as_ref(),
        token_b_mint.as_ref(),
        &[bump],
    ];
    let signer_seeds = &[&seeds[..]];

    // Transfer token A to user
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.token_a_vault.to_account_info(),
                to: ctx.accounts.user_token_a.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            },
            signer_seeds,
        ),
        amount_a,
    )?;

    // Transfer token B to user
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.token_b_vault.to_account_info(),
                to: ctx.accounts.user_token_b.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            },
            signer_seeds,
        ),
        amount_b,
    )?;

    // Update pool state
    let pool = &mut ctx.accounts.pool;
    pool.reserve_a = pool
        .reserve_a
        .checked_sub(amount_a)
        .ok_or(DexError::MathOverflow)?;
    pool.reserve_b = pool
        .reserve_b
        .checked_sub(amount_b)
        .ok_or(DexError::MathOverflow)?;
    pool.total_lp_supply = pool
        .total_lp_supply
        .checked_sub(lp_token_amount)
        .ok_or(DexError::MathOverflow)?;

    emit!(LiquidityRemoved {
        pool: pool.key(),
        user: ctx.accounts.user.key(),
        amount_a,
        amount_b,
        lp_tokens_burned: lp_token_amount,
    });

    Ok(())
}
