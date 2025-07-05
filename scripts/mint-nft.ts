import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import * as dotenv from "dotenv";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { resolve } from "path";

dotenv.config();

// Candy Machine ID from your deployment
const CANDY_MACHINE_ID = "AgSUCUKAMyRFJ9tEoq6jQx6jKoGnKad14B5RZrruWj7h";

async function loadKeypair(): Promise<anchor.web3.Keypair> {
  const keypairPath = resolve(homedir(), ".config/solana/id.json");
  const secret = await readFile(keypairPath, "utf-8");
  return anchor.web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
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

  console.log("🍬 Minting NFT from Candy Machine...");
  console.log("👤 User:", userKP.publicKey.toBase58());
  console.log("🍭 Candy Machine:", CANDY_MACHINE_ID);

  try {
    // Use Sugar CLI to mint
    const { execSync } = require("child_process");

    console.log("\n🚀 Running: sugar mint");
    const output = execSync("sugar mint", {
      encoding: "utf8",
      cwd: process.cwd(),
    });

    console.log("✅ Mint output:");
    console.log(output);

    // Extract mint address from output (you'll need to look for it in the output)
    console.log("\n📝 Look for the mint address in the output above.");
    console.log("Then update your .env file with:");
    console.log("NFT_MINT=<mint_address_from_output>");
  } catch (error) {
    console.error("❌ Error minting NFT:", error);

    // Fallback: show how to mint manually
    console.log("\n📋 Manual minting instructions:");
    console.log("1. Run: sugar mint");
    console.log("2. Copy the mint address from the output");
    console.log("3. Update your .env file with: NFT_MINT=<mint_address>");
  }
}

main().catch((err) => {
  console.error("❌ Script error:", err);
  process.exit(1);
});
