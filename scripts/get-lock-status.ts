import * as anchor from "@coral-xyz/anchor";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import * as dotenv from "dotenv";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { resolve } from "path";
import { LockAccount } from "./types";

dotenv.config();

// === CONFIG & SEEDS ===
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);
const NFT_MINT = new PublicKey(process.env.NFT_MINT!);
const NFT_LOCK_SEED = "nft_lock";
const VAULT_AUTH_SEED = "nft_vault_authority";

async function loadKeypair(): Promise<anchor.web3.Keypair> {
  const keypairPath = resolve(homedir(), ".config/solana/id.json");
  const secret = await readFile(keypairPath, "utf-8");
  return anchor.web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

async function main() {
  const userKP = await loadKeypair();
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const wallet = new anchor.Wallet(userKP);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Load IDL and create program instance
  const idlPath = resolve(__dirname, "../target/idl/skornftlocking.json");
  const idlRaw = await readFile(idlPath, "utf-8");
  const idl = JSON.parse(idlRaw);
  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  const user = userKP.publicKey;
  const nftMint = NFT_MINT;

  // Derive PDAs
  const [lockAccountPDA] = PublicKey.findProgramAddressSync(
    [user.toBuffer(), Buffer.from(NFT_LOCK_SEED), nftMint.toBuffer()],
    program.programId
  );

  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_AUTH_SEED)],
    program.programId
  );

  // Derive token accounts
  const userNftAccount = getAssociatedTokenAddressSync(nftMint, user);
  const vaultNftAccount = getAssociatedTokenAddressSync(
    nftMint,
    vaultAuthority,
    true
  );

  console.log("🔍 Checking lock status for user:", user.toBase58());
  console.log("🪙 NFT Mint:", nftMint.toBase58());
  console.log("🔍 Lock Account PDA:", lockAccountPDA.toBase58());
  console.log("🏦 Vault Authority:", vaultAuthority.toBase58());
  console.log("👛 User NFT Account:", userNftAccount.toBase58());
  console.log("🔒 Vault NFT Account:", vaultNftAccount.toBase58());

  // Check user's current NFT balance
  try {
    const userNftAccountInfo = await getAccount(connection, userNftAccount);
    console.log("\n💰 User NFT Balance:", Number(userNftAccountInfo.amount));
  } catch (error) {
    console.log("\n💰 User NFT Balance: 0 (account doesn't exist)");
  }

  // Check vault's NFT balance
  try {
    const vaultNftAccountInfo = await getAccount(connection, vaultNftAccount);
    console.log("🔒 Vault NFT Balance:", Number(vaultNftAccountInfo.amount));
  } catch (error) {
    console.log("🔒 Vault NFT Balance: 0 (account doesn't exist)");
  }

  // Check if lock account exists and get its details
  try {
    const lockAccount = (await program.account.lockAccount.fetch(
      lockAccountPDA
    )) as LockAccount;

    console.log("\n📋 Lock Account Details:");
    console.log("Owner:", lockAccount.owner.toBase58());
    console.log("NFT Mint:", lockAccount.nftMint.toBase58());
    console.log(
      "Start Time:",
      new Date(lockAccount.startTime.toNumber() * 1000).toLocaleString()
    );
    console.log("Duration (seconds):", lockAccount.duration.toNumber());
    console.log("Duration (days):", lockAccount.duration.toNumber() / 86400);
    console.log("Unlocked:", lockAccount.unlocked);

    // Calculate time remaining
    const now = Math.floor(Date.now() / 1000);
    const unlockTime =
      lockAccount.startTime.toNumber() + lockAccount.duration.toNumber();
    const timeRemaining = unlockTime - now;

    console.log("\n⏰ Time Analysis:");
    console.log("Current Time:", new Date(now * 1000).toLocaleString());
    console.log("Unlock Time:", new Date(unlockTime * 1000).toLocaleString());

    if (lockAccount.unlocked) {
      console.log("✅ Status: NFT is unlocked");
    } else if (timeRemaining > 0) {
      const daysRemaining = Math.floor(timeRemaining / 86400);
      const hoursRemaining = Math.floor((timeRemaining % 86400) / 3600);
      const minutesRemaining = Math.floor((timeRemaining % 3600) / 60);

      console.log("🔒 Status: NFT is locked");
      console.log(
        `⏳ Time remaining: ${daysRemaining} days, ${hoursRemaining} hours, ${minutesRemaining} minutes`
      );
    } else {
      console.log("🔓 Status: Lock period has expired - NFT can be unlocked");
    }
  } catch (error) {
    console.log(
      "\n📋 Lock Account: Does not exist (no lock found for this user/NFT combination)"
    );
  }
}

main().catch((err) => {
  console.error("❌ Script error:", err);
  process.exit(1);
});
