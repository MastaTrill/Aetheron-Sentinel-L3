use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod sentinel_core {
    use super::*;

    /// Initializes the Sentinel Core state.
    /// This sets the initial heartbeat, yield target, and sync timestamp.
    pub fn initialize(ctx: Context<Initialize>, target_yield_bps: u32) -> Result<()> {
        let sentinel_state = &mut ctx.accounts.sentinel_state;
        sentinel_state.authority = ctx.accounts.authority.key();
        sentinel_state.heartbeat_active = true;
        sentinel_state.target_yield_bps = target_yield_bps;
        
        let clock = Clock::get()?;
        sentinel_state.last_sync_timestamp = clock.unix_timestamp as u64;

        msg!("Sentinel Core initialized successfully on Solana.");
        Ok(())
    }

    /// Pulses the heartbeat, verifying system liveliness and updating the timestamp.
    /// Access is restricted to the authority (keeper or admin).
    pub fn pulse_heartbeat(ctx: Context<PulseHeartbeat>) -> Result<()> {
        let sentinel_state = &mut ctx.accounts.sentinel_state;

        require!(
            sentinel_state.authority == ctx.accounts.authority.key(),
            SentinelError::Unauthorized
        );

        let clock = Clock::get()?;
        sentinel_state.last_sync_timestamp = clock.unix_timestamp as u64;

        msg!("Heartbeat pulsed at timestamp {}", sentinel_state.last_sync_timestamp);
        Ok(())
    }

    /// Halts the core operations in case of an emergency (Circuit Breaker).
    pub fn trigger_circuit_breaker(ctx: Context<TriggerCircuitBreaker>) -> Result<()> {
        let sentinel_state = &mut ctx.accounts.sentinel_state;

        require!(
            sentinel_state.authority == ctx.accounts.authority.key(),
            SentinelError::Unauthorized
        );

        sentinel_state.heartbeat_active = false;
        
        msg!("CRITICAL: Circuit breaker triggered. Sentinel operations halted.");
        Ok(())
    }
}

// --- Accounts ---

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init, 
        payer = authority, 
        space = 8 + 32 + 1 + 4 + 8 // Discriminator + Pubkey + bool + u32 + u64
    )]
    pub sentinel_state: Account<'info, SentinelState>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PulseHeartbeat<'info> {
    #[account(mut)]
    pub sentinel_state: Account<'info, SentinelState>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct TriggerCircuitBreaker<'info> {
    #[account(mut)]
    pub sentinel_state: Account<'info, SentinelState>,
    
    pub authority: Signer<'info>,
}

// --- State ---

/// SentinelState packs the core variables similarly to the EVM SentinelCore.sol
/// but leverages Solana's distinct account model.
#[account]
pub struct SentinelState {
    pub authority: Pubkey,            // 32 bytes
    pub heartbeat_active: bool,       // 1 byte
    pub target_yield_bps: u32,        // 4 bytes
    pub last_sync_timestamp: u64,     // 8 bytes
}

// --- Errors ---

#[error_code]
pub enum SentinelError {
    #[msg("Unauthorized access attempt detected.")]
    Unauthorized,
    #[msg("Sentinel is currently halted.")]
    Halted,
}
