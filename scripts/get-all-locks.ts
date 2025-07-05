import * as anchor from "@coral-xyz/anchor";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import * as dotenv from "dotenv";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { LockAccount } from "./types";

dotenv.config();

// === CONFIG & SEEDS ===
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);
const NFT_LOCK_SEED = "nft_lock";

async function main() {
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const provider = new anchor.AnchorProvider(connection, {} as any, {
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Load IDL and create program instance
  const idlPath = resolve(__dirname, "../target/idl/skornftlocking.json");
  const idlRaw = await readFile(idlPath, "utf-8");
  const idl = JSON.parse(idlRaw);
  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  console.log("🔍 Fetching all NFT locks...");

  // Get all lock accounts
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [{ dataSize: 8 + 32 + 32 + 8 + 8 + 1 }], // LockAccount size
  });

  console.log(`📦 Found ${accounts.length} lock accounts\n`);

  if (accounts.length === 0) {
    console.log("No locks found.");
    return;
  }

  let totalLocks = 0;
  let activeLocks = 0;
  let expiredLocks = 0;
  let unlockedLocks = 0;

  for (const { pubkey } of accounts) {
    try {
      const lockAccount = (await program.account.lockAccount.fetch(
        pubkey
      )) as LockAccount;
      totalLocks++;

      const now = Math.floor(Date.now() / 1000);
      const unlockTime =
        lockAccount.startTime.toNumber() + lockAccount.duration.toNumber();
      const timeRemaining = unlockTime - now;
      const daysRemaining = Math.floor(timeRemaining / 86400);

      console.log(`🔒 Lock #${totalLocks}:`);
      console.log(`   PDA: ${pubkey.toBase58()}`);
      console.log(`   Owner: ${lockAccount.owner.toBase58()}`);
      console.log(`   NFT Mint: ${lockAccount.nftMint.toBase58()}`);
      console.log(
        `   Start Time: ${new Date(
          lockAccount.startTime.toNumber() * 1000
        ).toLocaleString()}`
      );
      console.log(
        `   Duration: ${lockAccount.duration.toNumber() / 86400} days`
      );
      console.log(`   Unlocked: ${lockAccount.unlocked}`);

      if (lockAccount.unlocked) {
        unlockedLocks++;
        console.log(`   Status: ✅ Unlocked`);
      } else if (timeRemaining > 0) {
        activeLocks++;
        console.log(`   Status: 🔒 Active (${daysRemaining} days remaining)`);
      } else {
        expiredLocks++;
        console.log(`   Status: ⏰ Expired (can be unlocked)`);
      }

      console.log("");
    } catch (error) {
      console.error(
        `❌ Failed to decode lock account ${pubkey.toBase58()}:`,
        error
      );
    }
  }

  console.log("📊 Summary:");
  console.log(`Total Locks: ${totalLocks}`);
  console.log(`Active Locks: ${activeLocks}`);
  console.log(`Expired Locks: ${expiredLocks}`);
  console.log(`Unlocked Locks: ${unlockedLocks}`);
}

main().catch((err) => {
  console.error("❌ Script error:", err);
  process.exit(1);
});
