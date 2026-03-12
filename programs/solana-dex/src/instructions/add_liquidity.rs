use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};

use crate::errors::DexError;
use crate::events::LiquidityAdded;
use crate::state::Pool;

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
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

    /// The user providing liquidity
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<AddLiquidity>,
    amount_a: u64,
    amount_b: u64,
    min_lp_tokens: u64,
) -> Result<()> {
    require!(amount_a > 0 && amount_b > 0, DexError::ZeroAmount);

    let pool = &ctx.accounts.pool;
    let reserve_a = pool.reserve_a;
    let reserve_b = pool.reserve_b;
    let total_lp_supply = pool.total_lp_supply;

    // Calculate LP tokens to mint
    let lp_tokens_to_mint = if total_lp_supply == 0 {
        // First deposit: LP tokens = sqrt(amount_a * amount_b)
        let product = (amount_a as u128)
            .checked_mul(amount_b as u128)
            .ok_or(DexError::MathOverflow)?;
        integer_sqrt(product)
    } else {
        // Subsequent deposits: LP tokens = min(amount_a/reserve_a, amount_b/reserve_b) * total_supply
        let lp_from_a = (amount_a as u128)
            .checked_mul(total_lp_supply as u128)
            .ok_or(DexError::MathOverflow)?
            .checked_div(reserve_a as u128)
            .ok_or(DexError::MathOverflow)?;

        let lp_from_b = (amount_b as u128)
            .checked_mul(total_lp_supply as u128)
            .ok_or(DexError::MathOverflow)?
            .checked_div(reserve_b as u128)
            .ok_or(DexError::MathOverflow)?;

        std::cmp::min(lp_from_a, lp_from_b)
    };

    let lp_tokens_to_mint = lp_tokens_to_mint as u64;
    require!(lp_tokens_to_mint > 0, DexError::InsufficientLiquidity);
    require!(lp_tokens_to_mint >= min_lp_tokens, DexError::SlippageExceeded);

    // Transfer token A from user to vault
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_a.to_account_info(),
                to: ctx.accounts.token_a_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount_a,
    )?;

    // Transfer token B from user to vault
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_b.to_account_info(),
                to: ctx.accounts.token_b_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount_b,
    )?;

    // Mint LP tokens to user (using pool PDA as authority)
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

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.lp_mint.to_account_info(),
                to: ctx.accounts.user_lp_token.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            },
            signer_seeds,
        ),
        lp_tokens_to_mint,
    )?;

    // Update pool state
    let pool = &mut ctx.accounts.pool;
    pool.reserve_a = pool
        .reserve_a
        .checked_add(amount_a)
        .ok_or(DexError::MathOverflow)?;
    pool.reserve_b = pool
        .reserve_b
        .checked_add(amount_b)
        .ok_or(DexError::MathOverflow)?;
    pool.total_lp_supply = pool
        .total_lp_supply
        .checked_add(lp_tokens_to_mint)
        .ok_or(DexError::MathOverflow)?;

    let clock = Clock::get()?;
    emit!(LiquidityAdded {
        pool: pool.key(),
        user: ctx.accounts.user.key(),
        amount_a,
        amount_b,
        lp_tokens_minted: lp_tokens_to_mint,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

/// Integer square root using Newton's method
fn integer_sqrt(n: u128) -> u128 {
    if n == 0 {
        return 0;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}
