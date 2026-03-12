use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::DexError;
use crate::events::ProtocolFeesCollected;
use crate::state::Pool;

#[derive(Accounts)]
pub struct CollectProtocolFees<'info> {
    #[account(
        mut,
        seeds = [
            Pool::SEED_PREFIX,
            pool.token_a_mint.as_ref(),
            pool.token_b_mint.as_ref(),
        ],
        bump = pool.bump,
        has_one = admin @ DexError::Unauthorized,
    )]
    pub pool: Account<'info, Pool>,

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

    /// Treasury token A account to receive fees
    #[account(
        mut,
        constraint = treasury_token_a.mint == pool.token_a_mint,
    )]
    pub treasury_token_a: Account<'info, TokenAccount>,

    /// Treasury token B account to receive fees
    #[account(
        mut,
        constraint = treasury_token_b.mint == pool.token_b_mint,
    )]
    pub treasury_token_b: Account<'info, TokenAccount>,

    /// Admin authority
    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<CollectProtocolFees>) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let fees_a = pool.protocol_fees_a;
    let fees_b = pool.protocol_fees_b;

    require!(fees_a > 0 || fees_b > 0, DexError::NoProtocolFees);

    let token_a_mint = pool.token_a_mint;
    let token_b_mint = pool.token_b_mint;
    let bump = pool.bump;
    let seeds = &[
        Pool::SEED_PREFIX,
        token_a_mint.as_ref(),
        token_b_mint.as_ref(),
        &[bump],
    ];
    let signer_seeds = &[&seeds[..]];

    // Transfer token A fees
    if fees_a > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.token_a_vault.to_account_info(),
                    to: ctx.accounts.treasury_token_a.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
                signer_seeds,
            ),
            fees_a,
        )?;
    }

    // Transfer token B fees
    if fees_b > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.token_b_vault.to_account_info(),
                    to: ctx.accounts.treasury_token_b.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
                signer_seeds,
            ),
            fees_b,
        )?;
    }

    // Reset protocol fee counters
    let pool = &mut ctx.accounts.pool;
    pool.protocol_fees_a = 0;
    pool.protocol_fees_b = 0;

    emit!(ProtocolFeesCollected {
        pool: pool.key(),
        amount_a: fees_a,
        amount_b: fees_b,
        treasury: ctx.accounts.admin.key(),
    });

    Ok(())
}
