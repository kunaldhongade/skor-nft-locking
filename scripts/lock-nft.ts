import * as anchor from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
} from "@solana/web3.js";
import * as dotenv from "dotenv";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { resolve } from "path";
import { LockAccount, LockDuration } from "./types";

dotenv.config();

// === CONFIG & SEEDS ===
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);
const NFT_MINT = new PublicKey(process.env.NFT_MINT!);
const NFT_LOCK_SEED = "nft_lock";
const VAULT_AUTH_SEED = "nft_vault_authority";

// Duration options
const DURATION_OPTIONS: Record<string, LockDuration> = {
  Sixty: { sixty: {} },
  Ninety: { ninety: {} },
  OneEighty: { oneEighty: {} },
  ThreeSixtyFive: { threeSixtyFive: {} },
};

async function loadKeypair(): Promise<anchor.web3.Keypair> {
  const keypairPath = resolve(homedir(), ".config/solana/id.json");
  const secret = await readFile(keypairPath, "utf-8");
  return anchor.web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

async function ensureAta(
  connection: Connection,
  payer: PublicKey,
  ata: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  tx: Transaction
) {
  try {
    await getAccount(connection, ata);
  } catch {
    tx.add(createAssociatedTokenAccountInstruction(payer, ata, owner, mint));
  }
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

  console.log("🔍 Lock Account PDA:", lockAccountPDA.toBase58());
  console.log("🏦 Vault Authority:", vaultAuthority.toBase58());
  console.log("👛 User NFT Account:", userNftAccount.toBase58());
  console.log("🔒 Vault NFT Account:", vaultNftAccount.toBase58());

  // Ensure ATAs exist
  const ataTx = new Transaction();
  await ensureAta(connection, user, userNftAccount, nftMint, user, ataTx);
  await ensureAta(
    connection,
    user,
    vaultNftAccount,
    nftMint,
    vaultAuthority,
    ataTx
  );

  if (ataTx.instructions.length > 0) {
    const sig = await sendAndConfirmTransaction(connection, ataTx, [userKP]);
    console.log("✅ Created ATAs, tx:", sig);
  }

  // Check user's NFT balance
  try {
    const userNftAccountInfo = await getAccount(connection, userNftAccount);
    console.log("🪙 User NFT balance:", Number(userNftAccountInfo.amount));

    if (Number(userNftAccountInfo.amount) === 0) {
      console.error("❌ User doesn't own any of this NFT");
      return;
    }
  } catch (error) {
    console.error("❌ Error checking user NFT balance:", error);
    return;
  }

  // Get duration from environment or use default
  const durationStr = process.env.LOCK_DURATION || "Sixty";
  const duration =
    DURATION_OPTIONS[durationStr as keyof typeof DURATION_OPTIONS];

  if (!duration) {
    console.error(
      "❌ Invalid duration. Use: Sixty, Ninety, OneEighty, or ThreeSixtyFive"
    );
    return;
  }

  console.log(`🔒 Locking NFT for ${durationStr} days...`);

  try {
    const tx = await program.methods
      .lockNft(duration)
      .accounts({
        user,
        lockAccount: lockAccountPDA,
        userNftAccount,
        vaultNftAccount,
        nftMint,
        vaultAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    console.log("✅ NFT locked successfully!");
    console.log("📝 Transaction:", tx);

    // Fetch and display lock details
    const lockAccount = (await program.account.lockAccount.fetch(
      lockAccountPDA
    )) as LockAccount;
    console.log("\n📋 Lock Details:");
    console.log("Owner:", lockAccount.owner.toBase58());
    console.log("NFT Mint:", lockAccount.nftMint.toBase58());
    console.log(
      "Start Time:",
      new Date(lockAccount.startTime.toNumber() * 1000).toLocaleString()
    );
    console.log("Duration (seconds):", lockAccount.duration.toNumber());
    console.log("Duration (days):", lockAccount.duration.toNumber() / 86400);
    console.log("Unlocked:", lockAccount.unlocked);
  } catch (error) {
    console.error("❌ Failed to lock NFT:", error);
  }
}

main().catch((err) => {
  console.error("❌ Script error:", err);
  process.exit(1);
});
