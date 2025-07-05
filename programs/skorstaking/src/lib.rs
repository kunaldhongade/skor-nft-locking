use anchor_lang::prelude::*;
use anchor_spl::token_interface;

pub const VAULT_AUTH_SEED: &str = "vault_authority";
pub const STAKE_COUNTER_SEED: &str = "stake_counter";
pub const CONFIG_SEED: &str = "config";
pub const STAKE_SEED: &str = "stake";

pub const DECIMALS: u8 = 6;

declare_id!("3YdgNrgnMfgYNRi1MaTzNfBSwmJibnDD6Wnm4MewDfVt");

#[program]
pub mod skorstaking {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        stake_mint: Pubkey,
        monthly_cap: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.config.admin == Pubkey::default(),
            StakingError::AlreadyInitialized
        );
        let cfg = &mut ctx.accounts.config;
        cfg.admin = ctx.accounts.admin.key();
        cfg.stake_mint = stake_mint;
        cfg.monthly_cap = monthly_cap;
        cfg.paused_staking = false;
        cfg.monthly_distributed = 0;
        cfg.last_epoch_start = Clock::get()?.unix_timestamp;

        Ok(())
    }

    pub fn stake_tokens(
        ctx: Context<StakeTokens>,
        amount: u64,
        duration: StakingDuration,
    ) -> Result<()> {
        ctx.accounts.validate()?;
        let cfg = &ctx.accounts.config;
        require!(!cfg.paused_staking, StakingError::StakingPaused);
        require!(
            ctx.accounts.mint.decimals == DECIMALS,
            StakingError::InvalidDecimals
        );

        let minimum_stake = 100u64
            .checked_mul(10u64.pow(DECIMALS as u32))
            .ok_or(StakingError::Overflow)?;

        require!(amount >= minimum_stake, StakingError::BelowMinimum);

        require!(
            ctx.accounts.user_token_account.amount >= amount,
            StakingError::InsufficientTokenBalance
        );

        let expected_mint = cfg.stake_mint;
        require!(
            ctx.accounts.user_token_account.mint == expected_mint,
            StakingError::UnauthorizedToken
        );

        let cpi_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token_interface::TransferChecked {
                from: ctx.accounts.user_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token_interface::transfer_checked(cpi_context, amount, ctx.accounts.mint.decimals)?;

        let decimals = ctx.accounts.mint.decimals as u32;
        let normalized = amount
            .checked_div(10u64.pow(decimals))
            .ok_or(StakingError::Overflow)?;
        let tier = Tier::from_amount(normalized)?;
        let days = duration.days() as u64;
        let apy_bp = tier.apy_bp(days)?;

        let reward = calculate_simple_reward(amount, apy_bp, days)?;

        let index = ctx.accounts.stake_counter.count;

        let sa = &mut ctx.accounts.stake_account;
        sa.staker = ctx.accounts.user.key();
        sa.deposit_amount = amount;
        sa.reward_amount = reward;
        sa.start_time = Clock::get()?.unix_timestamp;
        sa.duration = duration.clone().days() * 86400;
        sa.claimed = false;
        sa.tier = tier;
        sa.index = index;

        ctx.accounts.stake_counter.count = index.checked_add(1).ok_or(StakingError::Overflow)?;

        Ok(())
    }

    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let (expected_vault_auth, _) =
            Pubkey::find_program_address(&[VAULT_AUTH_SEED.as_bytes()], ctx.program_id);
        require!(
            ctx.accounts.vault_authority.key() == expected_vault_auth,
            StakingError::Unauthorized
        );

        ctx.accounts.validate()?;
        let cfg = &mut ctx.accounts.config;
        let clock = Clock::get()?;
        let sa = &mut ctx.accounts.stake_account;
        require!(
            ctx.accounts.rewards_token_account.amount >= sa.reward_amount,
            StakingError::InsufficientRewards
        );

        let month_secs = 30 * 24 * 60 * 60;
        if clock.unix_timestamp > cfg.last_epoch_start + month_secs {
            cfg.monthly_distributed = 0;
            cfg.last_epoch_start = clock.unix_timestamp;
        }

        require!(!sa.claimed, StakingError::AlreadyClaimed);
        require!(
            clock.unix_timestamp >= sa.start_time + sa.duration,
            StakingError::StillLocked
        );

        let cap = cfg
            .monthly_cap
            .checked_mul(10u64.pow(ctx.accounts.mint.decimals as u32))
            .ok_or(StakingError::Overflow)?;
        require!(
            cfg.monthly_distributed
                .checked_add(sa.reward_amount)
                .ok_or(StakingError::Overflow)?
                <= cap,
            StakingError::MonthlyCapReached
        );

        let bump = ctx.bumps.vault_authority;
        let seeds = &[VAULT_AUTH_SEED.as_bytes(), &[bump]];
        let signer = &[&seeds[..]];
        let cpi_principal = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token_interface::TransferChecked {
                from: ctx.accounts.vault_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            signer,
        );
        token_interface::transfer_checked(
            cpi_principal,
            sa.deposit_amount,
            ctx.accounts.mint.decimals,
        )?;

        let cpi_reward = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token_interface::TransferChecked {
                from: ctx.accounts.rewards_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            signer,
        );
        token_interface::transfer_checked(
            cpi_reward,
            sa.reward_amount,
            ctx.accounts.mint.decimals,
        )?;

        sa.claimed = true;
        cfg.monthly_distributed = cfg
            .monthly_distributed
            .checked_add(sa.reward_amount)
            .ok_or(StakingError::Overflow)?;

        Ok(())
    }

    pub fn set_pause_staking(ctx: Context<SetPause>, paused: bool) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        require!(
            ctx.accounts.admin.key() == cfg.admin,
            StakingError::Unauthorized
        );
        cfg.paused_staking = paused;
        Ok(())
    }

    pub fn set_monthly_cap(
        ctx: Context<SetMonthlyCap>,
        new_monthly_cap: u64, // in whole tokens, e.g. 5_000_000
    ) -> Result<()> {
        let cfg: &mut Account<'_, Config> = &mut ctx.accounts.config;
        require!(
            ctx.accounts.admin.key() == cfg.admin,
            StakingError::Unauthorized
        );
        cfg.monthly_cap = new_monthly_cap;
        Ok(())
    }
}

fn calculate_simple_reward(principal: u64, apy_bp: u64, days: u64) -> Result<u64> {
    let num = (principal as u128)
        .checked_mul(apy_bp as u128)
        .ok_or(StakingError::Overflow)?
        .checked_mul(days as u128)
        .ok_or(StakingError::Overflow)?;
    let denom = 10_000u128.checked_mul(365).unwrap();
    let reward = num.checked_div(denom).ok_or(StakingError::Overflow)?;
    Ok(reward as u64)
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init_if_needed,
        payer = admin,
        space = 8 + Config::LEN,
        seeds = [CONFIG_SEED.as_bytes()],
        bump
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StakeTokens<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 8,
        seeds = [user.key().as_ref(), STAKE_COUNTER_SEED.as_bytes()],
        bump
    )]
    pub stake_counter: Account<'info, StakeCounter>,
    #[account(
        init,
        payer = user,
        space = 8 + StakeAccount::LEN,
        seeds = [user.key().as_ref(), STAKE_SEED.as_bytes(), &stake_counter.count.to_le_bytes()],
        bump
    )]
    pub stake_account: Account<'info, StakeAccount>,

    #[account(mut)]
    pub user_token_account: InterfaceAccount<'info, token_interface::TokenAccount>,
    pub mint: InterfaceAccount<'info, token_interface::Mint>,
    #[account(
        mut,
        constraint = vault_token_account.owner == vault_authority.key() @ StakingError::InvalidVaultOwner
    )]
    pub vault_token_account: InterfaceAccount<'info, token_interface::TokenAccount>,
    #[account(
        mut,
        constraint = rewards_token_account.owner == vault_authority.key() @ StakingError::InvalidVaultOwner
    )]
    pub rewards_token_account: InterfaceAccount<'info, token_interface::TokenAccount>,
    /// CHECK: This account is a PDA, and its address is derived using seeds.  It does not need to be checked.
    #[account(seeds = [VAULT_AUTH_SEED.as_bytes()], bump)]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(mut, seeds = [CONFIG_SEED.as_bytes()], bump)]
    pub config: Account<'info, Config>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        constraint = stake_account.staker == user.key() @ StakingError::Unauthorized,
    )]
    pub stake_account: Account<'info, StakeAccount>,
    #[account(mut)]
    pub user_token_account: InterfaceAccount<'info, token_interface::TokenAccount>,
    pub mint: InterfaceAccount<'info, token_interface::Mint>,
    #[account(
        mut,
        constraint = vault_token_account.owner == vault_authority.key() @ StakingError::InvalidVaultOwner
    )]
    pub vault_token_account: InterfaceAccount<'info, token_interface::TokenAccount>,
    #[account(
        mut,
        constraint = rewards_token_account.owner == vault_authority.key() @ StakingError::InvalidVaultOwner
    )]
    pub rewards_token_account: InterfaceAccount<'info, token_interface::TokenAccount>,
    /// CHECK: This account is a PDA, and its address is derived using seeds.  It does not need to be checked.
    #[account(seeds = [VAULT_AUTH_SEED.as_bytes()], bump)]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(mut, seeds = [CONFIG_SEED.as_bytes()], bump)]
    pub config: Account<'info, Config>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
}

#[derive(Accounts)]
pub struct SetPause<'info> {
    #[account(mut, seeds = [CONFIG_SEED.as_bytes()], bump)]
    pub config: Account<'info, Config>,
    pub admin: Signer<'info>,
}

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub stake_mint: Pubkey,
    pub monthly_cap: u64,
    pub paused_staking: bool,
    pub monthly_distributed: u64,
    pub last_epoch_start: i64,
}
impl Config {
    pub const LEN: usize = 32 + 32 + 8 + 1 + 1 + 8 + 8;
}

#[derive(Accounts)]
pub struct SetMonthlyCap<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED.as_bytes()],
        bump
    )]
    pub config: Account<'info, Config>,

    pub admin: Signer<'info>,
}

#[account]
pub struct StakeAccount {
    pub staker: Pubkey,
    pub deposit_amount: u64,
    pub reward_amount: u64,
    pub start_time: i64,
    pub duration: i64,
    pub claimed: bool,
    pub tier: Tier,
    pub index: u64,
}
impl StakeAccount {
    pub const LEN: usize = 32 + 8 + 8 + 8 + 8 + 1 + 1 + 8;
}

#[account]
pub struct StakeCounter {
    pub count: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum StakingDuration {
    Sixty,
    Ninety,
    OneEighty,
    ThreeSixtyFive,
}
impl StakingDuration {
    pub fn days(&self) -> i64 {
        match self {
            Self::Sixty => 60,
            Self::Ninety => 90,
            Self::OneEighty => 180,
            Self::ThreeSixtyFive => 365,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum Tier {
    Bronze,
    Silver,
    Gold,
}
impl Tier {
    pub fn from_amount(normalized: u64) -> Result<Self> {
        if normalized >= 300_000 {
            Ok(Self::Gold)
        } else if normalized >= 100_000 {
            Ok(Self::Silver)
        } else {
            Ok(Self::Bronze)
        }
    }
    pub fn apy_bp(&self, days: u64) -> Result<u64> {
        let col = match days {
            60 => 0,
            90 => 1,
            180 => 2,
            365 => 3,
            _ => return err!(StakingError::InvalidDuration),
        };
        let table = match self {
            Self::Bronze => [400, 600, 800, 1000],
            Self::Silver => [600, 900, 1200, 1500],
            Self::Gold => [800, 1200, 1600, 2000],
        };
        Ok(table[col])
    }
}

#[error_code]
pub enum StakingError {
    #[msg("Staking is paused")]
    StakingPaused,
    #[msg("Unauthorized token")]
    UnauthorizedToken,
    #[msg("Stake below minimum")]
    BelowMinimum,
    #[msg("Overflow error")]
    Overflow,
    #[msg("Invalid duration")]
    InvalidDuration,
    #[msg("Already claimed")]
    AlreadyClaimed,
    #[msg("Still locked")]
    StillLocked,
    #[msg("Unauthorized action")]
    Unauthorized,
    #[msg("Invalid vault owner")]
    InvalidVaultOwner,
    #[msg("Monthly cap reached, Try After some Time")]
    MonthlyCapReached,
    #[msg("Insufficient User Token Balance")]
    InsufficientTokenBalance,
    #[msg("Insufficient reward pool")]
    InsufficientRewards,
    #[msg("Invalid mint account")]
    InvalidMint,
    #[msg("Program has Already Initialized")]
    AlreadyInitialized,
    #[msg("Program only supports 6 decimals")]
    InvalidDecimals,
}

impl<'info> StakeTokens<'info> {
    pub fn validate(&self) -> Result<()> {
        require!(
            self.mint.key() == self.config.stake_mint,
            StakingError::InvalidMint
        );
        Ok(())
    }

    pub fn validate_owner(&self) -> Result<()> {
        if self.vault_token_account.owner != self.vault_authority.key() {
            return Err(ProgramError::InvalidArgument.into());
        }
        Ok(())
    }
}

impl<'info> ClaimRewards<'info> {
    pub fn validate(&self) -> Result<()> {
        require!(
            self.mint.key() == self.config.stake_mint,
            StakingError::InvalidMint
        );
        Ok(())
    }
}
