import * as anchor from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
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
  const adminKP = await loadKeypair();
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const wallet = new anchor.Wallet(adminKP);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Load IDL and create program instance
  const idlPath = resolve(__dirname, "../target/idl/skornftlocking.json");
  const idlRaw = await readFile(idlPath, "utf-8");
  const idl = JSON.parse(idlRaw);
  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  const admin = adminKP.publicKey;
  const nftMint = NFT_MINT;

  // Get user address from environment or prompt
  const userAddress = process.env.USER_ADDRESS;
  if (!userAddress) {
    console.error("❌ Please set USER_ADDRESS in environment variables");
    return;
  }

  const user = new PublicKey(userAddress);

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

  console.log("🔍 Lock Account PDA:", lockAccountPDA.toBase58());
  console.log("🏦 Vault Authority:", vaultAuthority.toBase58());
  console.log("👛 User NFT Account:", userNftAccount.toBase58());
  console.log("🔒 Vault NFT Account:", vaultNftAccount.toBase58());
  console.log("👤 User:", user.toBase58());
  console.log("👨‍💼 Admin:", admin.toBase58());

  // Check if lock account exists and get its details
  try {
    const lockAccount = (await program.account.lockAccount.fetch(
      lockAccountPDA
    )) as LockAccount;

    console.log("\n📋 Current Lock Details:");
    console.log("Owner:", lockAccount.owner.toBase58());
    console.log("NFT Mint:", lockAccount.nftMint.toBase58());
    console.log(
      "Start Time:",
      new Date(lockAccount.startTime.toNumber() * 1000).toLocaleString()
    );
    console.log("Duration (seconds):", lockAccount.duration.toNumber());
    console.log("Duration (days):", lockAccount.duration.toNumber() / 86400);
    console.log("Unlocked:", lockAccount.unlocked);

    if (lockAccount.unlocked) {
      console.log("❌ NFT is already unlocked!");
      return;
    }

    // Check if lock period has expired
    const now = Math.floor(Date.now() / 1000);
    const unlockTime =
      lockAccount.startTime.toNumber() + lockAccount.duration.toNumber();
    const timeRemaining = unlockTime - now;

    if (timeRemaining > 0) {
      console.log(`⏰ Lock period has not expired yet.`);
      console.log(
        `Unlock time: ${new Date(unlockTime * 1000).toLocaleString()}`
      );
      console.log(
        `Time remaining: ${Math.floor(
          timeRemaining / 86400
        )} days, ${Math.floor((timeRemaining % 86400) / 3600)} hours`
      );
      console.log("🔓 Admin unlock will proceed anyway...");
    } else {
      console.log("✅ Lock period has already expired.");
    }
  } catch (error) {
    console.error("❌ Error fetching lock account:", error);
    return;
  }

  try {
    const tx = await program.methods
      .adminUnlock()
      .accounts({
        admin,
        lockAccount: lockAccountPDA,
        userNftAccount,
        vaultNftAccount,
        nftMint,
        vaultAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("✅ NFT admin unlocked successfully!");
    console.log("📝 Transaction:", tx);

    // Fetch updated lock details
    const updatedLockAccount = (await program.account.lockAccount.fetch(
      lockAccountPDA
    )) as LockAccount;
    console.log("\n📋 Updated Lock Details:");
    console.log("Unlocked:", updatedLockAccount.unlocked);
  } catch (error) {
    console.error("❌ Failed to admin unlock NFT:", error);
  }
}

main().catch((err) => {
  console.error("❌ Script error:", err);
  process.exit(1);
});
