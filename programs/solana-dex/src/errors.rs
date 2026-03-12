use anchor_lang::prelude::*;

#[error_code]
pub enum DexError {
    #[msg("Insufficient liquidity in the pool")]
    InsufficientLiquidity,

    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,

    #[msg("Invalid fee rate: must be between 1 and 1000 basis points")]
    InvalidFeeRate,

    #[msg("Amount must be greater than zero")]
    ZeroAmount,

    #[msg("Cannot create a pool with identical token mints")]
    IdenticalMints,

    #[msg("Unauthorized: only the pool admin can perform this action")]
    Unauthorized,

    #[msg("Mathematical overflow occurred")]
    MathOverflow,

    #[msg("No protocol fees to collect")]
    NoProtocolFees,

    #[msg("Invalid swap direction")]
    InvalidSwapDirection,

    #[msg("Pool already initialized")]
    PoolAlreadyInitialized,
}
