import * as anchor from "@coral-xyz/anchor";
import {
  getAccount,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import * as dotenv from "dotenv";
import { readFile } from "fs/promises";
import { resolve } from "path";

dotenv.config();

const RPC_URL = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);
const MINT = new PublicKey(process.env.MINT!);
const VAULT_AUTH_SEED = "vault_authority";

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");

  // Load IDL & program
  const idlPath = resolve(__dirname, "../target/idl/skorstaking.json");
  const idlRaw = await readFile(idlPath, "utf-8");
  const idl = JSON.parse(idlRaw);
  const provider = new anchor.AnchorProvider(connection, {} as any, {
    preflightCommitment: "confirmed",
  });
  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  // Derive vault authority PDA
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_AUTH_SEED)],
    PROGRAM_ID
  );

  // Derive vault's rewards ATA
  const rewardsTokenAccount = await getAssociatedTokenAddress(
    MINT,
    vaultAuthority,
    true
  );

  // Fetch the mint to learn its decimals
  const mintInfo = await getMint(connection, MINT);
  const decimals = mintInfo.decimals;
  const divisor = 10 ** decimals;

  // Get vault token balance (base‐units → human)
  const tokenAccountInfo = await getAccount(connection, rewardsTokenAccount);
  const vaultBalance = Number(tokenAccountInfo.amount) / divisor;

  // Fetch all stakeAccount PDAs
  // (make sure your dataSize matches 8 + StakeAccount::LEN)
  const ACCOUNT_DISCRIM_SIZE = 8;
  const STAKE_ACCOUNT_SIZE =
    32 + // staker
    8 + // deposit_amount
    8 + // reward_amount
    8 + // start_time
    8 + // duration
    1 + // claimed
    1 + // tier
    8; // index
  const dataSize = ACCOUNT_DISCRIM_SIZE + STAKE_ACCOUNT_SIZE;

  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [{ dataSize }],
  });

  let totalStaked = 0;
  let totalRewardsGiven = 0;

  for (const { pubkey } of accounts) {
    const stake = (await program.account.stakeAccount.fetch(pubkey)) as {
      depositAmount: anchor.BN;
      rewardAmount: anchor.BN;
    };
    totalStaked += Number(stake.depositAmount);
    totalRewardsGiven += Number(stake.rewardAmount);
  }

  console.log("🏦 Vault Authority:      ", vaultAuthority.toBase58());
  console.log("🎁 Vault Token Account:  ", rewardsTokenAccount.toBase58());
  console.log(
    "💰 Vault Token Balance:   ",
    vaultBalance.toFixed(decimals),
    "tokens"
  );
  console.log(
    "📊 Total Staked Tokens:    ",
    (totalStaked / divisor).toFixed(decimals),
    "tokens"
  );
  console.log(
    "🎉 Total Rewards We need To Give:   ",
    (totalRewardsGiven / divisor).toFixed(decimals),
    "tokens"
  );
}

main().catch((err) => {
  console.error("❌ Script error:", err);
  process.exit(1);
});
