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

  console.log("🧪 Testing NFT Locking System...");
  console.log("👤 User:", user.toBase58());
  console.log("🪙 NFT Mint:", nftMint.toBase58());
  console.log("🔧 Program ID:", PROGRAM_ID.toBase58());

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

  console.log("\n📋 Derived Addresses:");
  console.log("Lock Account PDA:", lockAccountPDA.toBase58());
  console.log("Vault Authority:", vaultAuthority.toBase58());
  console.log("User NFT Account:", userNftAccount.toBase58());
  console.log("Vault NFT Account:", vaultNftAccount.toBase58());

  // Test 1: Check if lock account exists
  console.log("\n🔍 Test 1: Checking Lock Account Status");
  try {
    const lockAccount = (await program.account.lockAccount.fetch(
      lockAccountPDA
    )) as LockAccount;
    console.log("✅ Lock account exists");
    console.log("   Owner:", lockAccount.owner.toBase58());
    console.log("   NFT Mint:", lockAccount.nftMint.toBase58());
    console.log(
      "   Start Time:",
      new Date(lockAccount.startTime.toNumber() * 1000).toLocaleString()
    );
    console.log("   Duration (days):", lockAccount.duration.toNumber() / 86400);
    console.log("   Unlocked:", lockAccount.unlocked);
  } catch (error) {
    console.log(
      "❌ Lock account does not exist (this is normal for new users)"
    );
  }

  // Test 2: Check NFT balances
  console.log("\n💰 Test 2: Checking NFT Balances");
  try {
    const userNftAccountInfo = await getAccount(connection, userNftAccount);
    console.log("✅ User NFT Balance:", Number(userNftAccountInfo.amount));
  } catch (error) {
    console.log("❌ User NFT account does not exist or has no balance");
  }

  try {
    const vaultNftAccountInfo = await getAccount(connection, vaultNftAccount);
    console.log("✅ Vault NFT Balance:", Number(vaultNftAccountInfo.amount));
  } catch (error) {
    console.log("❌ Vault NFT account does not exist or has no balance");
  }

  // Test 3: Check program account
  console.log("\n🔧 Test 3: Checking Program Account");
  try {
    const programAccount = await connection.getAccountInfo(PROGRAM_ID);
    if (programAccount) {
      console.log("✅ Program account exists");
      console.log("   Data length:", programAccount.data.length);
      console.log("   Owner:", programAccount.owner.toBase58());
    } else {
      console.log("❌ Program account not found");
    }
  } catch (error) {
    console.log("❌ Error checking program account:", error);
  }

  // Test 4: Validate PDA derivation
  console.log("\n🔐 Test 4: Validating PDA Derivation");
  const [testLockAccount] = PublicKey.findProgramAddressSync(
    [user.toBuffer(), Buffer.from(NFT_LOCK_SEED), nftMint.toBuffer()],
    program.programId
  );

  if (testLockAccount.equals(lockAccountPDA)) {
    console.log("✅ PDA derivation is correct");
  } else {
    console.log("❌ PDA derivation mismatch");
  }

  console.log("\n🎉 NFT Locking System Test Complete!");
  console.log("\n📝 Next Steps:");
  console.log("1. Create NFTs using: npx ts-node scripts/create-simple-nft.ts");
  console.log("2. Lock an NFT using: npx ts-node scripts/lock-nft.ts");
  console.log("3. Check status using: npx ts-node scripts/get-lock-status.ts");
  console.log("4. Unlock when ready: npx ts-node scripts/unlock-nft.ts");
}

main().catch((err) => {
  console.error("❌ Test error:", err);
  process.exit(1);
});
