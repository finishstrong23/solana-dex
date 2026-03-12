use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct Pool {
    /// The first token mint
    pub token_a_mint: Pubkey,
    /// The second token mint
    pub token_b_mint: Pubkey,
    /// Token account holding token A reserves
    pub token_a_vault: Pubkey,
    /// Token account holding token B reserves
    pub token_b_vault: Pubkey,
    /// LP token mint address
    pub lp_mint: Pubkey,
    /// Trading fee rate in basis points (e.g., 25 = 0.25%)
    pub fee_rate: u16,
    /// Protocol fee rate in basis points (5 = 0.05%)
    pub protocol_fee_rate: u16,
    /// Current reserve of token A
    pub reserve_a: u64,
    /// Current reserve of token B
    pub reserve_b: u64,
    /// Accumulated protocol fees for token A
    pub protocol_fees_a: u64,
    /// Accumulated protocol fees for token B
    pub protocol_fees_b: u64,
    /// Admin authority that can collect protocol fees
    pub admin: Pubkey,
    /// PDA bump seed
    pub bump: u8,
    /// Total LP tokens in circulation (tracked separately for precision)
    pub total_lp_supply: u64,
}

impl Pool {
    /// Account size: 8 (discriminator) + fields
    pub const LEN: usize = 8 + // discriminator
        32 +    // token_a_mint
        32 +    // token_b_mint
        32 +    // token_a_vault
        32 +    // token_b_vault
        32 +    // lp_mint
        2 +     // fee_rate
        2 +     // protocol_fee_rate
        8 +     // reserve_a
        8 +     // reserve_b
        8 +     // protocol_fees_a
        8 +     // protocol_fees_b
        32 +    // admin
        1 +     // bump
        8 +     // total_lp_supply
        64;     // padding for future use

    pub const SEED_PREFIX: &'static [u8] = b"pool";
    pub const PROTOCOL_FEE_RATE: u16 = 5; // 5 basis points = 0.05%
}
