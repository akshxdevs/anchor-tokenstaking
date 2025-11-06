#![allow(unexpected_cfgs,deprecated)]
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("BVDrLAadH4UztWb68aykei6Af1L1Vj2cJHv91G9AqNu2");

#[program]
pub mod anchor_token {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, bump: u8) -> Result<()> {
        ctx.accounts.vault.owner = ctx.accounts.user.key();
        ctx.accounts.vault.bump = bump;
        ctx.accounts.vault.balance = 0;
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(
            ctx.accounts.vault.owner == ctx.accounts.user.key(),
            CustomError::NotOwner
        );

        // Manual token account checks
        let user_token = TokenAccount::try_deserialize(&mut &ctx.accounts.user_ata.data.borrow()[..])?;
        require!(user_token.owner == ctx.accounts.user.key(), CustomError::InvalidATAOwner);

        let cpi_accounts = Transfer {
            from: ctx.accounts.user_ata.clone(),
            to: ctx.accounts.vault_ata.clone(),
            authority: ctx.accounts.user.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token::transfer(cpi_ctx, amount)?;
        ctx.accounts.vault.balance = ctx.accounts.vault.balance.checked_add(amount).unwrap();
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(
            ctx.accounts.vault.owner == ctx.accounts.user.key(),
            CustomError::NotOwner
        );
        require!(
            ctx.accounts.vault.balance >= amount,
            CustomError::InsufficientFunds
        );

        let vault_seeds = &[
            b"vault",
            ctx.accounts.user.key.as_ref(),
            &[ctx.accounts.vault.bump],
        ];
        let signer = &[&vault_seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_ata.clone(),
            to: ctx.accounts.user_ata.clone(),
            authority: ctx.accounts.vault_signer.clone(),
        };

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );

        token::transfer(cpi_ctx, amount)?;
        ctx.accounts.vault.balance = ctx.accounts.vault.balance.checked_sub(amount).unwrap();

        Ok(())
    }
}

#[account]
pub struct Vault {
    pub owner: Pubkey,
    pub bump: u8,
    pub balance: u64,
}

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 1 + 8,
        seeds = [b"vault", user.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: manually deserialized TokenAccount
    #[account(mut)]
    pub user_ata: AccountInfo<'info>,
    /// CHECK: manually deserialized TokenAccount
    #[account(mut)]
    pub vault_ata: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: manually deserialized TokenAccount
    #[account(mut)]
    pub user_ata: AccountInfo<'info>,
    /// CHECK: manually deserialized TokenAccount
    #[account(mut)]
    pub vault_ata: AccountInfo<'info>,
    /// CHECK: PDA signer
    #[account(
        seeds = [b"vault", user.key().as_ref()],
        bump = vault.bump
    )]
    pub vault_signer: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum CustomError {
    #[msg("You are not the vault owner.")]
    NotOwner,
    #[msg("Insufficient funds in vault.")]
    InsufficientFunds,
    #[msg("TokenAccount does not belong to signer.")]
    InvalidATAOwner,
}
