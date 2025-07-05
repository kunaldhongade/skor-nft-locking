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

dotenv.config();

const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);
const MINT = new PublicKey(process.env.MINT!);
const VAULT_AUTH_SEED = "vault_authority";
const CONFIG_SEED = "config";
const STAKE_COUNTER_SEED = "stake_counter";
const STAKE_SEED = "stake";
const STAKE_AMOUNT_WHOLE = new anchor.BN(process.env.STAKE_AMOUNT_WHOLE!);
const DURATION = process.env.STAKE_DURATION! as
  | "Sixty"
  | "Ninety"
  | "OneEighty"
  | "ThreeSixtyFive";

function getDurationEnum(duration: typeof DURATION) {
  switch (duration) {
    case "Sixty": return { sixty: {} };
    case "Ninety": return { ninety: {} };
    case "OneEighty": return { oneEighty: {} };
    case "ThreeSixtyFive": return { threeSixtyFive: {} };
    default: throw new Error(`Invalid duration: ${duration}`);
  }
}

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
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const wallet = new anchor.Wallet(payerKP);
  const provider = new anchor.AnchorProvider(connection, wallet, { preflightCommitment: "confirmed" });
  anchor.setProvider(provider);

  const idlPath = resolve(__dirname, "../target/idl/skorstaking.json");
  const idlRaw = await readFile(idlPath, "utf-8");
  const idl = JSON.parse(idlRaw);
  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  const user = payerKP.publicKey;
  const mint = MINT;
  const DECIMALS = 6;

  const [configPDA] = PublicKey.findProgramAddressSync([Buffer.from(CONFIG_SEED)], program.programId);
  const [vaultAuthority] = PublicKey.findProgramAddressSync([Buffer.from(VAULT_AUTH_SEED)], program.programId);
  const [stakeCounterPDA] = PublicKey.findProgramAddressSync([
    user.toBuffer(),
    Buffer.from(STAKE_COUNTER_SEED),
  ], program.programId);

  let index = 0;
  try {
    const counter = await program.account.stakeCounter.fetch(stakeCounterPDA);
    index = (counter as any).count.toNumber();
  } catch {}

  const [stakeAccountPDA] = PublicKey.findProgramAddressSync([
    user.toBuffer(),
    Buffer.from(STAKE_SEED),
    new anchor.BN(index).toArrayLike(Buffer, "le", 8),
  ], program.programId);

  const userTokenAccount = getAssociatedTokenAddressSync(mint, user);
  const vaultTokenAccount = getAssociatedTokenAddressSync(mint, vaultAuthority, true);

  const ataTx = new Transaction();
  await ensureAta(connection, user, userTokenAccount, mint, user, ataTx);
  if (ataTx.instructions.length > 0) {
    const sig = await sendAndConfirmTransaction(connection, ataTx, [payerKP]);
    console.log("✅ Created user ATA, tx:", sig);
  }

  const userAcct = await getAccount(connection, userTokenAccount);
  console.log("👛 User Address:", user.toBase58());
  console.log("🪙 User ATA:", userTokenAccount.toBase58());
  console.log("👤 User balance:", Number(userAcct.amount) / 1e6, "tokens");

  const amountBase = STAKE_AMOUNT_WHOLE.mul(new anchor.BN(10).pow(new anchor.BN(DECIMALS)));

  console.log(`\u{1F5F3} Staking ${STAKE_AMOUNT_WHOLE.toString()} tokens for ${DURATION}`);
  try {
    const tx = await program.methods
      .stakeTokens(amountBase, getDurationEnum(DURATION))
      .accounts({
        user,
        stakeCounter: stakeCounterPDA,
        stakeAccount: stakeAccountPDA,
        userTokenAccount,
        mint,
        vaultTokenAccount,
        rewardsTokenAccount: vaultTokenAccount,
        vaultAuthority,
        config: configPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    console.log("✅ stakeTokens succeeded, tx:", tx);
  } catch (err) {
    console.error("❌ stakeTokens failed:", err);
  }
}

main().catch((err) => {
  console.error("❌ Script error:", err);
  process.exit(1);
});
