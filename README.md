# Anchor-TokenStaking

A Solana Anchor-based program implementing a token staking system for yield farming.

## Overview

Anchor-TokenStaking is a smart contract (on Solana, using the Anchor framework) that enables users to stake SPL tokens into liquidity pools to earn rewards over time. It supports time-based reward accrual using the Solana Clock sysvar, allowing for vesting periods, cooldowns on unstaking, and proportional reward distribution. The contract manages stakes securely with PDAs and ensures rewards are claimable only after meeting criteria, promoting long-term holding in DeFi protocols.

## Features

- **Initialize Staking Pool**: Admin creates a pool with reward token mint, APY rate, and lockup duration.

- **Stake Tokens**: Users deposit tokens into the pool; stake account tracks amount and start time.

- **Unstake Tokens**: After cooldown, users can withdraw principal; rewards calculated based on stake duration.

- **Claim Rewards**: Users claim accrued rewards separately, with optional compounding.

- **Event Emissions**: Emits events (`PoolInitialized`, `Staked`, `Unstaked`, `RewardsClaimed`) for tracking and UI updates.

## How It Works

1\. **Initialize**: Admin calls `initialize_pool`, setting pool PDA with config: reward mint, base APY (scaled u64), min lockup (slots), total staked tracker. Pool account created.

2\. **Stake**: User calls `stake`, transferring tokens to pool's vault ATA. User stake PDA initialized with amount, timestamp; total staked updated.

3\. **Unstake**: After lockup, user calls `unstake` with amount. Principal returned; rewards accrued = (staked * time_staked * APY) / scale. Stake PDA closed if zero.

4\. **Claim**: User calls `claim` to mint/transfer rewards to their ATA; accrual recalculated without affecting principal.

### Main Data Structure

```rust

#[account]

pub struct StakingPool {

    pub admin: Pubkey,

    pub reward_mint: Pubkey,

    pub apy: u64,          // Scaled (e.g., 1e6 for 100%)

    pub min_lockup: u64,   // Slots

    pub total_staked: u64,

    pub bump: u8,

}

#[account]

pub struct UserStake {

    pub owner: Pubkey,

    pub pool: Pubkey,

    pub staked_amount: u64,

    pub start_slot: u64,

    pub rewards_debt: u64, // Pending rewards

    pub bump: u8,

}

```

## Usage

### Clone the Repo

```bash

git clone https://github.com/akshxdevs/anchor-tokenstaking.git

cd anchor-tokenstaking

```

### Install Dependencies

```bash

yarn install

```

### Build the Project

```bash

anchor build

```

### Test the Project

```bash

anchor test

```

## Example Flow

- **Airdrop and mint tokens** for admin and user accounts; setup reward mint.

- Admin calls `initialize_pool` with APY=10%, lockup=100 slots.

- User stakes 1000 tokens via `stake`; starts accruing.

- After 200 slots, user calls `claim` → receives ~20 reward tokens.

- User calls `unstake` 1000 → principal returned, additional rewards claimed.

## Key Files

- `programs/anchor-tokenstaking/src/lib.rs`: Anchor program logic and instruction definitions.

- `programs/anchor-tokenstaking/src/instructions/`: Individual instruction handlers (`initialize_pool`, `stake`, `unstake`, `claim`).

- `programs/anchor-tokenstaking/src/state.rs`: StakingPool and UserStake structs with accrual math.

- `tests/anchor-tokenstaking.ts`: Integration tests for accrual, lockups, compounding, and edge cases (early unstake).

## Events

- `PoolInitialized`: Emitted on pool creation with config params.

- `Staked`: Emitted on stake with user, amount, and start slot.

- `Unstaked`: Emitted on unstake with amount and rewards paid.

- `RewardsClaimed`: Emitted on claim with user and reward amount.

## Requirements

- Node.js, Yarn

- Solana CLI tools

- Anchor CLI

## License

MIT

---

For more details, see the program code and the test suite.
