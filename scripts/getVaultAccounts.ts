import {
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import * as dotenv from "dotenv";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { resolve } from "path";
dotenv.config();

// Constants
const MINT = new PublicKey(process.env.MINT!);
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);
const VAULT_AUTH_SEED = "vault_authority";

const getKeypair = async (): Promise<Keypair> => {
  const path = resolve(homedir(), ".config/solana/id.json");
  const secret = await readFile(path, "utf-8");
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(secret)));
};

const main = async () => {
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const payer = await getKeypair();

  // Fetch mint to get decimals
  const mintInfo = await getMint(connection, MINT);
  const decimals = mintInfo.decimals;
  const divisor = 10 ** decimals;
  console.log("🔢 Mint decimals:", decimals);

  // Vault authority PDA
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_AUTH_SEED)],
    PROGRAM_ID
  );

  // ATAs
  const depositVaultATA = getAssociatedTokenAddressSync(
    MINT,
    vaultAuthority,
    true
  );
  const rewardVaultATA = getAssociatedTokenAddressSync(
    MINT,
    vaultAuthority,
    true
  );

  console.log("🏦 Vault Authority PDA:", vaultAuthority.toBase58());
  console.log("📥 Deposit Vault ATA:", depositVaultATA.toBase58());
  console.log("🎁 Reward Vault ATA:", rewardVaultATA.toBase58());

  // Create ATAs if missing
  const tx = new Transaction();
  try {
    await getAccount(connection, depositVaultATA);
  } catch {
    console.log("🔧 Creating Deposit Vault ATA...");
    tx.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        depositVaultATA,
        vaultAuthority,
        MINT
      )
    );
  }
  try {
    await getAccount(connection, rewardVaultATA);
  } catch {
    console.log("🔧 Creating Reward Vault ATA...");
    tx.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        rewardVaultATA,
        vaultAuthority,
        MINT
      )
    );
  }
  if (tx.instructions.length > 0) {
    const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
    console.log("✅ Vault ATAs initialized. Tx:", sig);
  } else {
    console.log("✅ Vault ATAs already exist.");
  }

  // Fetch raw token accounts and format with decimals
  const depositAcct = await getAccount(connection, depositVaultATA);
  const rewardAcct = await getAccount(connection, rewardVaultATA);

  console.log(
    "💰 Deposit Vault Balance:",
    (Number(depositAcct.amount) / divisor).toFixed(decimals),
    "tokens"
  );
  console.log(
    "🎉 Reward Vault Balance:",
    (Number(rewardAcct.amount) / divisor).toFixed(decimals),
    "tokens"
  );
};

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
