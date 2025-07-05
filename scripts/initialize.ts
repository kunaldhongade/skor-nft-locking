import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { readFile } from "fs/promises";
import { resolve, join } from "path";
import { homedir } from "os";
import * as dotenv from "dotenv";

dotenv.config();

const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);
const MINT = new PublicKey(process.env.MINT!);
const MONTHLY_CAP = new anchor.BN(process.env.MONTHLY_CAP!);

const CONFIG_SEED = "config";
const GLOBAL_STATS_SEED = "global_stats";

async function loadKeypair(): Promise<anchor.web3.Keypair> {
  const keypairPath = resolve(homedir(), ".config/solana/mainnet-wallet.json");
  const secret = await readFile(keypairPath, "utf-8");
  return anchor.web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

async function main() {
  const walletKeypair = await loadKeypair();

  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Load IDL properly
  const idlPath = resolve(__dirname, "../target/idl/skorstaking.json");
  const idlRaw = await readFile(idlPath, "utf-8");
  const idl = JSON.parse(idlRaw);

  // Instantiate program correctly
  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  // Derive PDAs
  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    program.programId
  );
  const [globalStatsPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(GLOBAL_STATS_SEED)],
    program.programId
  );

  console.log("📋 PDAs:");
  console.log("  config:", configPDA.toBase58());
  console.log("  global_stats:", globalStatsPDA.toBase58());
  console.log("  admin:", wallet.publicKey.toBase58());

  // Call initialize
  try {
    const tx = await program.methods
      .initialize(MINT, MONTHLY_CAP)
      .accounts({
        config: configPDA,
        admin: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Initialize succeeded, tx:", tx);
  } catch (err: any) {
    console.error("❌ Initialize failed:", err);
    if (err instanceof anchor.AnchorError) {
      console.error("  Code:", err.error.errorCode);
      console.error("  Msg :", err.error.errorMessage);
    }
  }
}

main().catch((err) => {
  console.error("❌ Script error:", err);
  process.exit(1);
});