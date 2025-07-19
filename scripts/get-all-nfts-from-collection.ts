import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
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

async function loadCacheFile() {
  try {
    const cachePath = resolve(__dirname, "../cache.json");
    const cacheData = await readFile(cachePath, "utf-8");
    return JSON.parse(cacheData);
  } catch (error) {
    console.log("⚠️ Could not load cache.json file");
    return null;
  }
}

async function getAllNFTsByOwner(
  connection: Connection,
  ownerAddress: PublicKey
) {
  try {
    console.log("\n👤 Fetching all NFTs owned by your wallet...");

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      ownerAddress,
      {
        programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      }
    );

    const nfts = [];
    for (const { account, pubkey } of tokenAccounts.value) {
      const tokenInfo = account.data.parsed.info;
      // NFTs typically have decimals of 0 and amount of 1
      if (
        tokenInfo.tokenAmount.decimals === 0 &&
        tokenInfo.tokenAmount.amount === "1"
      ) {
        nfts.push({
          mint: tokenInfo.mint,
          tokenAccount: pubkey.toBase58(),
          owner: tokenInfo.owner,
          amount: tokenInfo.tokenAmount.amount,
        });
      }
    }

    return nfts;
  } catch (error) {
    console.error("Error fetching NFTs by owner:", error);
    return [];
  }
}

async function getNFTMetadata(connection: Connection, mintAddress: string) {
  try {
    const mint = new PublicKey(mintAddress);

    // Derive metadata account
    const [metadataAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
        mint.toBuffer(),
      ],
      new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s") // Metaplex Token Metadata program
    );

    const metadataAccountInfo = await connection.getAccountInfo(
      metadataAccount
    );

    if (metadataAccountInfo) {
      // Simple metadata parsing (you might want to use @metaplex-foundation/mpl-token-metadata for proper parsing)
      return {
        metadataAccount: metadataAccount.toBase58(),
        exists: true,
      };
    }

    return {
      metadataAccount: metadataAccount.toBase58(),
      exists: false,
    };
  } catch (error) {
    console.error(`Error fetching metadata for ${mintAddress}:`, error);
    return null;
  }
}

async function getAllMintedNFTsFromCache(cacheData: any) {
  if (!cacheData || !cacheData.items) {
    return [];
  }

  const nfts = [];
  const itemKeys = Object.keys(cacheData.items).filter((key) => key !== "-1");

  for (const key of itemKeys) {
    const item = cacheData.items[key];
    if (item.onChain) {
      nfts.push({
        name: item.name,
        imageLink: item.image_link,
        metadataLink: item.metadata_link,
        index: parseInt(key),
      });
    }
  }

  return nfts;
}

async function findNFTMintAddresses(
  connection: Connection,
  candyMachineId: string
) {
  try {
    console.log("\n🔍 Searching for minted NFTs from Candy Machine...");

    // Get all accounts that were created by this candy machine
    // This is a simplified approach - in practice, you'd need to look at transaction history
    const candyMachine = new PublicKey(candyMachineId);

    // For now, we'll use a different approach - check your wallet for NFTs
    return [];
  } catch (error) {
    console.error("Error finding NFT mint addresses:", error);
    return [];
  }
}

async function main() {
  const userKP = await loadKeypair();
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  console.log("🎨 All NFTs from Collection");
  console.log("===========================");
  console.log("👤 Your wallet:", userKP.publicKey.toBase58());

  // Load cache data
  const cacheData = await loadCacheFile();

  if (cacheData && cacheData.program) {
    console.log("\n📋 Collection Details:");
    console.log("🍭 Candy Machine ID:", cacheData.program.candyMachine);
    console.log("🏛️ Collection Mint:", cacheData.program.collectionMint);

    // Get all NFTs from cache (these are the NFTs that CAN be minted)
    const cachedNFTs = await getAllMintedNFTsFromCache(cacheData);
    if (cachedNFTs.length > 0) {
      console.log(
        `\n📦 NFTs defined in collection (from cache): ${cachedNFTs.length}`
      );
      cachedNFTs.slice(0, 5).forEach((nft, index) => {
        console.log(`\n${index + 1}. ${nft.name}`);
        console.log(`   Image: ${nft.imageLink}`);
        console.log(`   Metadata: ${nft.metadataLink}`);
        console.log(`   On-chain: ✅`);
      });

      if (cachedNFTs.length > 5) {
        console.log(
          `\n... and ${cachedNFTs.length - 5} more NFTs in the collection`
        );
      }
    }

    // Get all NFTs owned by your wallet
    const userNFTs = await getAllNFTsByOwner(connection, userKP.publicKey);
    if (userNFTs.length > 0) {
      console.log(`\n👛 NFTs currently in your wallet: ${userNFTs.length}`);

      for (let i = 0; i < Math.min(userNFTs.length, 10); i++) {
        const nft = userNFTs[i];
        console.log(`\n${i + 1}. NFT:`);
        console.log(`   Mint Address: ${nft.mint}`);
        console.log(`   Token Account: ${nft.tokenAccount}`);

        // Get metadata for this NFT
        const metadata = await getNFTMetadata(connection, nft.mint);
        if (metadata) {
          console.log(`   Metadata Account: ${metadata.metadataAccount}`);
          console.log(`   Has Metadata: ${metadata.exists ? "✅" : "❌"}`);
        }
      }

      if (userNFTs.length > 10) {
        console.log(
          `\n... and ${userNFTs.length - 10} more NFTs in your wallet`
        );
      }
    } else {
      console.log("\n👛 No NFTs found in your wallet");
      console.log(
        "💡 Tip: Mint an NFT first using: npx ts-node scripts/mint-nft.ts"
      );
    }

    console.log("\n🎯 Collection Summary:");
    console.log(`📊 Total NFTs in collection design: ${cachedNFTs.length}`);
    console.log(`👛 NFTs you currently own: ${userNFTs.length}`);
    console.log(`🏛️ Collection Address: ${cacheData.program.collectionMint}`);

    console.log("\n📝 To mint NFTs from this collection:");
    console.log("1. Run: npx ts-node scripts/mint-nft.ts");
    console.log("2. Or use: sugar mint");
    console.log(
      "3. Each mint will create a new NFT with a unique mint address"
    );

    console.log("\n🔗 Useful Commands:");
    console.log("• View collection: sugar show");
    console.log("• Mint NFT: sugar mint");
    console.log("• Check wallet NFTs: solana address");
  } else {
    console.log("❌ No cache.json found or invalid format");
    console.log("\n📋 Alternative methods:");
    console.log("1. Use: sugar show");
    console.log("2. Check your wallet in Solana Explorer");
    console.log("3. Use a wallet app like Phantom or Solflare");
  }

  console.log("\n🔗 Explorer Links:");
  if (cacheData?.program?.candyMachine) {
    console.log(
      `Candy Machine: https://www.solana.fm/address/${cacheData.program.candyMachine}?cluster=devnet-alpha`
    );
  }
  if (cacheData?.program?.collectionMint) {
    console.log(
      `Collection: https://www.solana.fm/address/${cacheData.program.collectionMint}?cluster=devnet-alpha`
    );
  }
  console.log(
    `Your Wallet: https://www.solana.fm/address/${userKP.publicKey.toBase58()}?cluster=devnet-alpha`
  );
}

main().catch((err) => {
  console.error("❌ Script error:", err);
  process.exit(1);
});
