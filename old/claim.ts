import * as anchor from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
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

dotenv.config();

// === CONFIG & SEEDS ===
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);
const MINT = new PublicKey(process.env.MINT!);
const VAULT_AUTH_SEED = "vault_authority";
const CONFIG_SEED = "config";
const GLOBAL_STATS_SEED = "global_stats";
const USER_STATS_SEED = "user_stats";
const STAKE_COUNTER_SEED = "stake_counter";
const STAKE_SEED = "stake";

async function loadKeypair(): Promise<anchor.web3.Keypair> {
  const keypairPath = resolve(homedir(), ".config/solana/new-wallet.json");
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
  const payerKP = await loadKeypair();
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const wallet = new anchor.Wallet(payerKP);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  const idlPath = resolve(__dirname, "../target/idl/skorstaking.json");
  const idlRaw = await readFile(idlPath, "utf-8");
  const idl = JSON.parse(idlRaw);
  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  const user = payerKP.publicKey;
  const mint = MINT;

  // Fetch mint info to get decimals
  const mintInfo = await getMint(connection, mint);
  const decimals = mintInfo.decimals;
  const divisor = 10 ** decimals;
  console.log("🔢 Token Decimals:", decimals);

  // --- Derive PDAs ---
  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    program.programId
  );

  const [globalStatsPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(GLOBAL_STATS_SEED)],
    program.programId
  );

  const [userStatsPDA] = PublicKey.findProgramAddressSync(
    [user.toBuffer(), Buffer.from(USER_STATS_SEED)],
    program.programId
  );

  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_AUTH_SEED)],
    program.programId
  );

  const [stakeCounterPDA] = PublicKey.findProgramAddressSync(
    [user.toBuffer(), Buffer.from(STAKE_COUNTER_SEED)],
    program.programId
  );

  // --- Fetch stake counter ---
  let counterBn: anchor.BN;
  try {
    const sc = await program.account.stakeCounter.fetch(stakeCounterPDA);
    counterBn = (sc as any).count;
  } catch {
    console.log("No stakes found for user");
    return;
  }
  const totalStakes = counterBn.toNumber();
  if (totalStakes === 0) {
    console.log("User has no stakes to claim.");
    return;
  }

  // --- Prepare ATAs ---
  const userTokenAccount = getAssociatedTokenAddressSync(mint, user);
  const vaultTokenAccount = getAssociatedTokenAddressSync(
    mint,
    vaultAuthority,
    true
  );
  const ataTx = new Transaction();
  await ensureAta(connection, user, userTokenAccount, mint, user, ataTx);
  if (ataTx.instructions.length > 0) {
    const sig = await sendAndConfirmTransaction(connection, ataTx, [payerKP]);
    console.log("✅ Created user ATA, tx:", sig);
  }

  // --- Iterate and claim each stake ---
  for (let i = 0; i < totalStakes; i++) {
    const idxBn = new anchor.BN(i);
    const [stakeAccountPDA] = PublicKey.findProgramAddressSync(
      [
        user.toBuffer(),
        Buffer.from(STAKE_SEED),
        idxBn.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    console.log(
      `\n📤 Attempting claim for stake #${i} at ${stakeAccountPDA.toBase58()}`
    );
    try {
      const txSig = await program.methods
        .claimRewards()
        .accounts({
          user,
          stakeAccount: stakeAccountPDA,
          userTokenAccount,
          mint,
          vaultTokenAccount,
          rewardsTokenAccount: vaultTokenAccount,
          vaultAuthority,
          config: configPDA,
          globalStats: globalStatsPDA,
          userStats: userStatsPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      console.log(`✅ claimRewards #${i} succeeded:`, txSig);
    } catch (err: any) {
      const msg = err.error?.errorMessage || err.message;
      console.log(`⚠️ stake #${i} claim skipped or failed: ${msg}`);
    }
  }
}

main().catch((err) => {
  console.error("❌ Script error:", err);
  process.exit(1);
});
