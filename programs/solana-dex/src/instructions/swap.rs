use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::DexError;
use crate::events::SwapExecuted;
use crate::state::Pool;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum SwapDirection {
    AToB,
    BToA,
}

#[derive(Accounts)]
pub struct Swap<'info> {
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

    /// The user performing the swap
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<Swap>,
    amount_in: u64,
    min_amount_out: u64,
    swap_direction: SwapDirection,
) -> Result<()> {
    require!(amount_in > 0, DexError::ZeroAmount);

    let pool = &ctx.accounts.pool;
    let fee_rate = pool.fee_rate as u128;
    let (reserve_in, reserve_out) = match swap_direction {
        SwapDirection::AToB => (pool.reserve_a as u128, pool.reserve_b as u128),
        SwapDirection::BToA => (pool.reserve_b as u128, pool.reserve_a as u128),
    };

    require!(reserve_in > 0 && reserve_out > 0, DexError::InsufficientLiquidity);

    let amount_in_u128 = amount_in as u128;

    // Calculate total fee
    let total_fee = amount_in_u128
        .checked_mul(fee_rate)
        .ok_or(DexError::MathOverflow)?
        .checked_div(10000)
        .ok_or(DexError::MathOverflow)?;

    // Protocol fee = 20% of total fee
    let protocol_fee = total_fee
        .checked_mul(2000)
        .ok_or(DexError::MathOverflow)?
        .checked_div(10000)
        .ok_or(DexError::MathOverflow)?;

    // Amount after deducting total fee
    let effective_amount_in = amount_in_u128
        .checked_sub(total_fee)
        .ok_or(DexError::MathOverflow)?;

    // Constant product formula: amount_out = (reserve_out * effective_amount_in) / (reserve_in + effective_amount_in)
    let numerator = reserve_out
        .checked_mul(effective_amount_in)
        .ok_or(DexError::MathOverflow)?;
    let denominator = reserve_in
        .checked_add(effective_amount_in)
        .ok_or(DexError::MathOverflow)?;
    let amount_out = numerator
        .checked_div(denominator)
        .ok_or(DexError::MathOverflow)? as u64;

    // Slippage protection
    require!(amount_out >= min_amount_out, DexError::SlippageExceeded);
    require!(amount_out > 0, DexError::InsufficientLiquidity);

    // Execute transfers based on direction
    match swap_direction {
        SwapDirection::AToB => {
            // User sends token A to vault
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.user_token_a.to_account_info(),
                        to: ctx.accounts.token_a_vault.to_account_info(),
                        authority: ctx.accounts.user.to_account_info(),
                    },
                ),
                amount_in,
            )?;

            // Vault sends token B to user (PDA signer)
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
                amount_out,
            )?;
        }
        SwapDirection::BToA => {
            // User sends token B to vault
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.user_token_b.to_account_info(),
                        to: ctx.accounts.token_b_vault.to_account_info(),
                        authority: ctx.accounts.user.to_account_info(),
                    },
                ),
                amount_in,
            )?;

            // Vault sends token A to user (PDA signer)
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
                amount_out,
            )?;
        }
    }

    // Update pool reserves and protocol fees
    let pool = &mut ctx.accounts.pool;
    let protocol_fee_u64 = protocol_fee as u64;

    match swap_direction {
        SwapDirection::AToB => {
            // LP fee portion stays in the pool (added to reserve via the transfer)
            pool.reserve_a = pool.reserve_a
                .checked_add(amount_in)
                .ok_or(DexError::MathOverflow)?
                .checked_sub(protocol_fee_u64)
                .ok_or(DexError::MathOverflow)?;
            pool.reserve_b = pool.reserve_b
                .checked_sub(amount_out)
                .ok_or(DexError::MathOverflow)?;
            pool.protocol_fees_a = pool.protocol_fees_a
                .checked_add(protocol_fee_u64)
                .ok_or(DexError::MathOverflow)?;
        }
        SwapDirection::BToA => {
            pool.reserve_a = pool.reserve_a
                .checked_sub(amount_out)
                .ok_or(DexError::MathOverflow)?;
            pool.reserve_b = pool.reserve_b
                .checked_add(amount_in)
                .ok_or(DexError::MathOverflow)?
                .checked_sub(protocol_fee_u64)
                .ok_or(DexError::MathOverflow)?;
            pool.protocol_fees_b = pool.protocol_fees_b
                .checked_add(protocol_fee_u64)
                .ok_or(DexError::MathOverflow)?;
        }
    }

    let clock = Clock::get()?;
    let (token_in_mint, token_out_mint) = match swap_direction {
        SwapDirection::AToB => (pool.token_a_mint, pool.token_b_mint),
        SwapDirection::BToA => (pool.token_b_mint, pool.token_a_mint),
    };
    emit!(SwapExecuted {
        pool: pool.key(),
        user: ctx.accounts.user.key(),
        token_in_mint,
        token_out_mint,
        amount_in,
        amount_out,
        fee: total_fee as u64,
        reserve_a_after: pool.reserve_a,
        reserve_b_after: pool.reserve_b,
        swap_direction: match swap_direction {
            SwapDirection::AToB => 0,
            SwapDirection::BToA => 1,
        },
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
