// scripts/pauseStaking.ts

import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import * as dotenv from "dotenv";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { resolve } from "path";

dotenv.config();

const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);
const CONFIG_SEED = "config";

async function loadKeypair(): Promise<anchor.web3.Keypair> {
  const secret = await readFile(
    resolve(homedir(), ".config/solana/id.json"),
    "utf-8"
  );
  return anchor.web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

async function main() {
  const payer = await loadKeypair();
  const connection = new anchor.web3.Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const wallet = new anchor.Wallet(payer);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  // load IDL
  const idlPath = resolve(__dirname, "../target/idl/skorstaking.json");
  const idlRaw = await readFile(idlPath, "utf-8");
  const idl = JSON.parse(idlRaw);
  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  // derive config PDA
  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    program.programId
  );

  // read desired pause flag from .env
  const PAUSE = process.env.PAUSE?.toLowerCase() === "true";

  console.log(
    `🔄 setPauseStaking(${PAUSE}) on ${configPDA.toBase58()} on programId ${PROGRAM_ID}`
  );
  try {
    const tx = await program.methods
      .setPauseStaking(PAUSE)
      .accounts({
        config: configPDA,
        admin: payer.publicKey,
      })
      .rpc();
    console.log("✅ Success, tx:", tx);
  } catch (err) {
    console.error("❌ Failed:", err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
