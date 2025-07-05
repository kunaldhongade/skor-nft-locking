use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

pub const NFT_LOCK_SEED: &str = "nft_lock";
pub const VAULT_AUTH_SEED: &str = "nft_vault_authority";

declare_id!("3CN3wBxMpJnRNndTd8NvghTWRPLbE8c824aBUGBXeSMe");

#[program]
pub mod nftlocking {
    use super::*;

    pub fn lock_nft(ctx: Context<LockNFT>, duration: LockDuration) -> Result<()> {
        let lock_account = &mut ctx.accounts.lock_account;
        lock_account.owner = ctx.accounts.user.key();
        lock_account.nft_mint = ctx.accounts.nft_mint.key();
        lock_account.start_time = Clock::get()?.unix_timestamp;
        lock_account.duration = duration.days() * 86400;
        lock_account.unlocked = false;

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_nft_account.to_account_info(),
                to: ctx.accounts.vault_nft_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, 1)?;

        Ok(())
    }

    pub fn unlock_nft(ctx: Context<UnlockNFT>) -> Result<()> {
        let lock_account = &mut ctx.accounts.lock_account;
        require!(!lock_account.unlocked, LockError::AlreadyUnlocked);

        let now = Clock::get()?.unix_timestamp;
        require!(
            now >= lock_account.start_time + lock_account.duration,
            LockError::StillLocked
        );

        lock_account.unlocked = true;

        let bump = ctx.bumps.vault_authority;
        let signer_seeds = &[VAULT_AUTH_SEED.as_bytes(), &[bump]];
        let signer = &[&signer_seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_nft_account.to_account_info(),
                to: ctx.accounts.user_nft_account.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi_ctx, 1)?;

        Ok(())
    }

    pub fn admin_unlock(ctx: Context<AdminUnlock>) -> Result<()> {
        let lock_account = &mut ctx.accounts.lock_account;
        require!(!lock_account.unlocked, LockError::AlreadyUnlocked);

        lock_account.unlocked = true;

        let bump = ctx.bumps.vault_authority;
        let signer_seeds = &[VAULT_AUTH_SEED.as_bytes(), &[bump]];
        let signer = &[&signer_seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_nft_account.to_account_info(),
                to: ctx.accounts.user_nft_account.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi_ctx, 1)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct LockNFT<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = 8 + LockAccount::LEN,
        seeds = [user.key().as_ref(), NFT_LOCK_SEED.as_bytes(), nft_mint.key().as_ref()],
        bump
    )]
    pub lock_account: Account<'info, LockAccount>,
    #[account(mut)]
    pub user_nft_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault_nft_account: Account<'info, TokenAccount>,
    pub nft_mint: Account<'info, Mint>,
    /// CHECK: PDA
    #[account(seeds = [VAULT_AUTH_SEED.as_bytes()], bump)]
    pub vault_authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct UnlockNFT<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [user.key().as_ref(), NFT_LOCK_SEED.as_bytes(), nft_mint.key().as_ref()],
        bump,
        constraint = lock_account.owner == user.key() @ LockError::Unauthorized
    )]
    pub lock_account: Account<'info, LockAccount>,
    #[account(mut)]
    pub user_nft_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault_nft_account: Account<'info, TokenAccount>,
    pub nft_mint: Account<'info, Mint>,
    /// CHECK: PDA
    #[account(seeds = [VAULT_AUTH_SEED.as_bytes()], bump)]
    pub vault_authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AdminUnlock<'info> {
    pub admin: Signer<'info>,
    #[account(mut)]
    pub lock_account: Account<'info, LockAccount>,
    #[account(mut)]
    pub user_nft_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault_nft_account: Account<'info, TokenAccount>,
    pub nft_mint: Account<'info, Mint>,
    /// CHECK: PDA
    #[account(seeds = [VAULT_AUTH_SEED.as_bytes()], bump)]
    pub vault_authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct LockAccount {
    pub owner: Pubkey,
    pub nft_mint: Pubkey,
    pub start_time: i64,
    pub duration: i64,
    pub unlocked: bool,
}
impl LockAccount {
    pub const LEN: usize = 32 + 32 + 8 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum LockDuration {
    Sixty,
    Ninety,
    OneEighty,
    ThreeSixtyFive,
}
impl LockDuration {
    pub fn days(&self) -> i64 {
        match self {
            Self::Sixty => 60,
            Self::Ninety => 90,
            Self::OneEighty => 180,
            Self::ThreeSixtyFive => 365,
        }
    }
}

#[error_code]
pub enum LockError {
    #[msg("NFT is still locked")]
    StillLocked,
    #[msg("Already unlocked")]
    AlreadyUnlocked,
    #[msg("Unauthorized user")]
    Unauthorized,
}
