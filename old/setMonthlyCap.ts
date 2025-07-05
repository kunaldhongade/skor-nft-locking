// scripts/set_monthly_cap.ts

import * as anchor from "@project-serum/anchor";
import { Commitment, Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as dotenv from "dotenv";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { resolve } from "path";

dotenv.config();

// ─── CONFIG ────────────────────────────────────────────────────────────────────
// Your program ID
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);
// How many whole tokens to set as the new monthly cap
const NEW_MONTHLY_CAP = Number(process.env.MONTHLY_CAP!);
// (Optional) override RPC url
const RPC_URL = process.env.RPC_URL ?? "https://api.devnet.solana.com";
// PDA seed for config
const CONFIG_SEED = "config";

async function loadKeypair(): Promise<Keypair> {
  const path = resolve(homedir(), ".config/solana/id.json");
  const secret = await readFile(path, "utf-8");
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(secret)));
}

async function main() {
  // ── SETUP PROVIDER ───────────────────────────────────────────────────────────
  const keypair = await loadKeypair();
  const connection = new Connection(RPC_URL, "confirmed" as Commitment);
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  // ── LOAD IDL & PROGRAM ───────────────────────────────────────────────────────
  const idlPath = resolve(__dirname, "../target/idl/skorstaking.json");
  const idl = JSON.parse(await readFile(idlPath, "utf-8")) as anchor.Idl;
  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  // ── DERIVE CONFIG PDA ────────────────────────────────────────────────────────
  const [configPda, configBump] = await PublicKey.findProgramAddress(
    [Buffer.from(CONFIG_SEED)],
    PROGRAM_ID
  );

  console.log(
    "💡 Setting monthly cap to",
    NEW_MONTHLY_CAP.toLocaleString(),
    "tokens"
  );
  console.log("   Config PDA:", configPda.toBase58());
  console.log("   Admin:", wallet.publicKey.toBase58());

  // ── RPC CALL ─────────────────────────────────────────────────────────────────
  try {
    const tx = await program.methods
      .setMonthlyCap(NEW_MONTHLY_CAP)
      .accounts({
        config: configPda,
        admin: wallet.publicKey,
      })
      .rpc();

    console.log("✅ Transaction sent:", tx);
  } catch (err: any) {
    console.error("❌ Failed to set monthly cap:", err);
    process.exit(1);
  }
}

main();
