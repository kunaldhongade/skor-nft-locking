import * as anchor from "@project-serum/anchor";
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
const STAKE_COUNTER_SEED = "stake_counter";
const STAKE_SEED = "stake";
const CONFIG_SEED = "config";
const GLOBAL_STATS_SEED = "global_stats";
const USER_STATS_SEED = "user_stats";

type TierName = "bronze" | "silver" | "gold";

const TEST_CASES: {
  name: string;
  amount: number; // whole tokens
  duration: "sixty" | "ninety" | "oneEighty" | "threeSixtyFive";
  expectedTier: TierName;
}[] = [
  {
    name: "Bronze/60 Days",
    amount: 10000,
    duration: "sixty",
    expectedTier: "bronze",
  },
  {
    name: "Silver/90 Days",
    amount: 100000,
    duration: "ninety",
    expectedTier: "silver",
  },
  {
    name: "Gold/365 Days",
    amount: 300000,
    duration: "threeSixtyFive",
    expectedTier: "gold",
  },
];

async function loadKeypair(): Promise<anchor.web3.Keypair> {
  const path = resolve(homedir(), ".config/solana/id.json");
  const secret = await readFile(path, "utf-8");
  return anchor.web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

function getDurationEnum(d: (typeof TEST_CASES)[number]["duration"]) {
  return { [d]: {} };
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

function extractTier(t: any): TierName {
  if ("bronze" in t) return "bronze";
  if ("silver" in t) return "silver";
  if ("gold" in t) return "gold";
  throw new Error("Unknown tier enum: " + JSON.stringify(t));
}

async function main() {
  const keypair = await loadKeypair();
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  // load IDL & program
  const idlPath = resolve(__dirname, "../target/idl/skorstaking.json");
  const idl = JSON.parse(await readFile(idlPath, "utf-8"));
  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  // fetch mint decimals
  const mintInfo = await getMint(connection, MINT);
  const decimals = mintInfo.decimals;

  const user = keypair.publicKey;
  const mint = MINT;

  // derive PDAs
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

  for (const test of TEST_CASES) {
    console.log(
      `\n🧪 ${test.name}: amount=${test.amount}, duration=${test.duration}`
    );

    // stake counter PDA
    const [stakeCounterPDA] = PublicKey.findProgramAddressSync(
      [user.toBuffer(), Buffer.from(STAKE_COUNTER_SEED)],
      program.programId
    );

    // fetch counter
    let indexBN = new anchor.BN(0);
    try {
      const sc: any = await program.account.stakeCounter.fetch(stakeCounterPDA);
      indexBN = sc.count;
    } catch {}

    // stake account PDA
    const [stakeAccountPDA] = PublicKey.findProgramAddressSync(
      [
        user.toBuffer(),
        Buffer.from(STAKE_SEED),
        indexBN.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    // ensure ATA
    const userATA = getAssociatedTokenAddressSync(mint, user);
    const ataTx = new Transaction();
    await ensureAta(connection, user, userATA, mint, user, ataTx);
    if (ataTx.instructions.length) await provider.sendAndConfirm(ataTx);

    // compute amount in base units using on-chain decimal
    const amountBase = new anchor.BN(test.amount).mul(
      new anchor.BN(10).pow(new anchor.BN(decimals))
    );

    try {
      const txSig = await program.methods
        .stakeTokens(amountBase, getDurationEnum(test.duration))
        .accounts({
          user,
          stakeCounter: stakeCounterPDA,
          stakeAccount: stakeAccountPDA,
          userTokenAccount: userATA,
          mint,
          vaultTokenAccount: getAssociatedTokenAddressSync(
            mint,
            vaultAuthority,
            true
          ),
          rewardsTokenAccount: getAssociatedTokenAddressSync(
            mint,
            vaultAuthority,
            true
          ),
          vaultAuthority,
          config: configPDA,
          globalStats: globalStatsPDA,
          userStats: userStatsPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      console.log(`✅ stakeTokens tx: ${txSig}`);

      const stakeData: any = await program.account.stakeAccount.fetch(
        stakeAccountPDA
      );
      const actualTier = extractTier(stakeData.tier);
      if (actualTier === test.expectedTier)
        console.log(`✅ Tier correct: ${actualTier}`);
      else
        console.error(
          `❌ Tier mismatch: expected ${test.expectedTier}, got ${actualTier}`
        );
    } catch (err) {
      console.error("❌ stakeTokens error:", err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
