import * as anchor from "@project-serum/anchor";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
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
const STAKE_COUNTER_SEED = "stake_counter";
const STAKE_SEED = "stake";
const CONFIG_SEED = "config";
const GLOBAL_STATS_SEED = "global_stats";
const USER_STATS_SEED = "user_stats";

async function loadProgram() {
  const secret = await readFile(
    resolve(homedir(), ".config/solana/id.json"),
    "utf-8"
  );
  const keypair = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(secret))
  );

  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  const idlPath = resolve(__dirname, "../target/idl/skorstaking.json");
  const idlRaw = await readFile(idlPath, "utf-8");
  const idl = JSON.parse(idlRaw);
  const program = new anchor.Program(idl, PROGRAM_ID, provider);
  return { program, provider, connection, wallet };
}

async function main() {
  const { program, provider, connection, wallet } = await loadProgram();
  const user = wallet.publicKey;
  const mint = MINT;

  // Derive PDAs
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_AUTH_SEED)],
    program.programId
  );
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

  // derive stakeCounter & stakeAccount for latest index
  const [stakeCounterPDA] = PublicKey.findProgramAddressSync(
    [user.toBuffer(), Buffer.from(STAKE_COUNTER_SEED)],
    program.programId
  );
  const counter = await program.account.stakeCounter.fetch(stakeCounterPDA);
  const index = (counter as any).count.toNumber() - 1;
  const [stakeAccountPDA] = PublicKey.findProgramAddressSync(
    [
      user.toBuffer(),
      Buffer.from(STAKE_SEED),
      new anchor.BN(index).toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  // ATAs
  const userTokenAccount = getAssociatedTokenAddressSync(mint, user);
  const vaultTokenAccount = getAssociatedTokenAddressSync(
    mint,
    vaultAuthority,
    true
  );
  const rewardsTokenAccount = vaultTokenAccount;

  // === Unauthorized Claim ===
  console.log("\n🔒 Testing Unauthorized Claim...");
  const attacker = Keypair.generate();
  try {
    await program.methods
      .claimRewards()
      .accounts({
        user: attacker.publicKey,
        stakeAccount: stakeAccountPDA,
        userTokenAccount: getAssociatedTokenAddressSync(
          mint,
          attacker.publicKey
        ),
        mint,
        vaultTokenAccount,
        rewardsTokenAccount,
        vaultAuthority,
        config: configPDA,
        globalStats: globalStatsPDA,
        userStats: userStatsPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([attacker])
      .rpc();
    console.error("❌ Unauthorized Claim test failed: no error");
  } catch (err: any) {
    console.log(
      "✅ Unauthorized Claim passed:",
      err.error?.errorMessage || err.message
    );
  }

  // === Vault Ownership Check ===
  console.log("\n🔒 Testing Vault Ownership Check...");
  const fakeVault = Keypair.generate();
  try {
    await program.methods
      .claimRewards()
      .accounts({
        user,
        stakeAccount: stakeAccountPDA,
        userTokenAccount,
        mint,
        vaultTokenAccount: getAssociatedTokenAddressSync(
          mint,
          fakeVault.publicKey,
          true
        ),
        rewardsTokenAccount: getAssociatedTokenAddressSync(
          mint,
          fakeVault.publicKey,
          true
        ),
        vaultAuthority: fakeVault.publicKey,
        config: configPDA,
        globalStats: globalStatsPDA,
        userStats: userStatsPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.error("❌ Vault Ownership test failed: no error");
  } catch (err: any) {
    console.log(
      "✅ Vault Ownership passed:",
      err.error?.errorMessage || err.message
    );
  }

  // === Double Claim ===
  console.log("\n🔒 Testing Double Claim...");
  try {
    const tx1 = await program.methods
      .claimRewards()
      .accounts({
        user,
        stakeAccount: stakeAccountPDA,
        userTokenAccount,
        mint,
        vaultTokenAccount,
        rewardsTokenAccount,
        vaultAuthority,
        config: configPDA,
        globalStats: globalStatsPDA,
        userStats: userStatsPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log("✅ First claim succeeded:", tx1);

    await program.methods
      .claimRewards()
      .accounts({
        user,
        stakeAccount: stakeAccountPDA,
        userTokenAccount,
        mint,
        vaultTokenAccount,
        rewardsTokenAccount,
        vaultAuthority,
        config: configPDA,
        globalStats: globalStatsPDA,
        userStats: userStatsPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.error("❌ Double Claim test failed: no error");
  } catch (err: any) {
    console.log(
      "✅ Double Claim passed:",
      err.error?.errorMessage || err.message
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
