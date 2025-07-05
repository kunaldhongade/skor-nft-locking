import * as anchor from "@project-serum/anchor";
import {
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
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
const DECIMALS = Number(process.env.DECIMALS || "9");
const SEEDS = {
  vaultAuthority: "vault_authority",
  stakeCounter: "stake_counter",
  stake: "stake",
  config: "config",
  globalStats: "global_stats",
  userStats: "user_stats",
};

// Tier thresholds for validation only
type TierName = "bronze" | "silver" | "gold";

const TEST_CASES: { name: string; amount: number; expected: TierName }[] = [
  { name: "Minimum Bronze Tier", amount: 1000, expected: "bronze" },
  { name: "Bronze Upper Boundary", amount: 99000, expected: "bronze" },
  { name: "Silver Lower Boundary", amount: 100000, expected: "silver" },
  { name: "Silver Upper Boundary", amount: 299999, expected: "silver" },
  { name: "Gold Tier", amount: 300000, expected: "gold" },
];

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
  const idl = JSON.parse(
    await readFile(
      resolve(__dirname, "../target/idl/skorstaking.json"),
      "utf-8"
    )
  );
  const program = new anchor.Program(idl, PROGRAM_ID, provider);
  return { program, provider, connection, wallet };
}

function getDurationVariant() {
  return { sixty: {} };
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

function extractTier(tierObj: any): TierName {
  if ("bronze" in tierObj) return "bronze";
  if ("silver" in tierObj) return "silver";
  if ("gold" in tierObj) return "gold";
  throw new Error("Unexpected tier variant: " + JSON.stringify(tierObj));
}

(async () => {
  const { program, provider, connection, wallet } = await loadProgram();
  const user = wallet.publicKey;
  const mint = MINT;

  // derive PDAs
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.vaultAuthority)],
    program.programId
  );
  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.config)],
    program.programId
  );
  const [globalStatsPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.globalStats)],
    program.programId
  );
  const [userStatsPDA] = PublicKey.findProgramAddressSync(
    [user.toBuffer(), Buffer.from(SEEDS.userStats)],
    program.programId
  );

  const userAta = getAssociatedTokenAddressSync(mint, user);
  const ataTx = new Transaction();
  await ensureAta(connection, user, userAta, mint, user, ataTx);
  if (ataTx.instructions.length) await provider.sendAndConfirm(ataTx);

  for (const test of TEST_CASES) {
    console.log(`\n🧪 ${test.name}: staking ${test.amount}`);

    const [stakeCounterPDA] = PublicKey.findProgramAddressSync(
      [user.toBuffer(), Buffer.from(SEEDS.stakeCounter)],
      program.programId
    );
    let idx = 0;
    try {
      const sc: any = await program.account.stakeCounter.fetch(stakeCounterPDA);
      idx = sc.count.toNumber();
    } catch {}

    const [stakeAccountPDA] = PublicKey.findProgramAddressSync(
      [
        user.toBuffer(),
        Buffer.from(SEEDS.stake),
        new anchor.BN(idx).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const amountBase = new anchor.BN(test.amount).mul(
      new anchor.BN(10).pow(new anchor.BN(DECIMALS))
    );

    await program.methods
      .stakeTokens(amountBase, getDurationVariant())
      .accounts({
        user,
        config: configPDA,
        globalStats: globalStatsPDA,
        userStats: userStatsPDA,
        stakeCounter: stakeCounterPDA,
        stakeAccount: stakeAccountPDA,
        userTokenAccount: userAta,
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
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const acct: any = await program.account.stakeAccount.fetch(stakeAccountPDA);
    const actual = extractTier(acct.tier);
    if (actual === test.expected) {
      console.log(`✅ Tier correct: ${actual}`);
    } else {
      console.error(`❌ Expected ${test.expected}, got ${actual}`);
    }
  }
})();
