import * as anchor from "@coral-xyz/anchor";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as dotenv from "dotenv";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { resolve } from "path";

dotenv.config();

async function loadKeypair(): Promise<anchor.web3.Keypair> {
  const keypairPath = resolve(homedir(), ".config/solana/id.json");
  const secret = await readFile(keypairPath, "utf-8");
  return anchor.web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

async function createSimpleNFT(
  connection: Connection,
  payer: Keypair,
  mint: Keypair,
  user: PublicKey,
  name: string
) {
  // Create the mint
  await createMint(
    connection,
    payer,
    payer.publicKey,
    payer.publicKey,
    0, // decimals (0 for NFTs)
    mint
  );

  // Get or create the token account
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint.publicKey,
    user
  );

  // Mint 1 token to the user
  const signature = await mintTo(
    connection,
    payer,
    mint.publicKey,
    tokenAccount.address,
    payer,
    1
  );

  return {
    mint: mint.publicKey,
    tokenAccount: tokenAccount.address,
    signature,
  };
}

async function main() {
  const payer = await loadKeypair();
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  console.log("🎨 Creating Simple NFT Collection...");
  console.log("👤 Payer:", payer.publicKey.toBase58());

  // NFT Collection Configuration
  const collectionConfig = {
    name: "SKORAI NFT Collection",
    symbol: "SKNFT",
    description: "Exclusive SKORAI NFT collection for locking",
  };

  console.log("\n📋 Collection Details:");
  console.log("Name:", collectionConfig.name);
  console.log("Symbol:", collectionConfig.symbol);
  console.log("Description:", collectionConfig.description);

  // Create multiple NFTs for the collection
  const nftCount = 5; // Number of NFTs to create
  const nfts = [];

  for (let i = 1; i <= nftCount; i++) {
    console.log(`\n🪙 Creating NFT #${i}...`);

    const mint = Keypair.generate();
    const nftName = `${collectionConfig.name} #${i}`;

    try {
      const result = await createSimpleNFT(
        connection,
        payer,
        mint,
        payer.publicKey,
        nftName
      );

      nfts.push({
        number: i,
        name: nftName,
        mint: result.mint.toBase58(),
        tokenAccount: result.tokenAccount.toBase58(),
        signature: result.signature,
      });

      console.log(`✅ NFT #${i} created successfully!`);
      console.log(`   Mint: ${result.mint.toBase58()}`);
      console.log(`   Token Account: ${result.tokenAccount.toBase58()}`);
      console.log(`   Transaction: ${result.signature}`);
    } catch (error) {
      console.error(`❌ Failed to create NFT #${i}:`, error);
    }
  }

  console.log("\n🎉 NFT Collection Created Successfully!");
  console.log("📊 Summary:");
  console.log(`Total NFTs created: ${nfts.length}`);

  console.log("\n🔗 NFT Details:");
  nfts.forEach((nft) => {
    console.log(`\n${nft.name}:`);
    console.log(`  Mint: ${nft.mint}`);
    console.log(`  Token Account: ${nft.tokenAccount}`);
    console.log(`  Transaction: ${nft.signature}`);
  });

  // Save NFT details to file for future reference
  const fs = require("fs");
  const nftData = {
    collection: collectionConfig,
    nfts: nfts,
    createdAt: new Date().toISOString(),
    note: "These are simple NFTs without metadata. For full metadata support, use Metaplex Sugar CLI.",
  };

  fs.writeFileSync(
    resolve(__dirname, "../data/simple-nft-collection.json"),
    JSON.stringify(nftData, null, 2)
  );

  console.log(
    "\n💾 NFT collection data saved to data/simple-nft-collection.json"
  );
  console.log(
    "\n🚀 You can now use any of these mint addresses in your NFT locking scripts!"
  );
  console.log("Example: NFT_MINT=" + nfts[0].mint);
  console.log(
    "\n📝 Note: These are simple NFTs. For full metadata support, follow the guide in setup-nft-collection.md"
  );
}

main().catch((err) => {
  console.error("❌ Script error:", err);
  process.exit(1);
});
