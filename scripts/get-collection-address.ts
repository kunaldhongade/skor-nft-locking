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

async function getAllNFTsFromCollection(
  connection: Connection,
  collectionMint: PublicKey
) {
  try {
    console.log("\n🔍 Searching for all NFTs in collection...");

    // Method 1: Get all token accounts for the collection
    const response = await connection.getParsedTokenAccountsByOwner(
      collectionMint,
      {
        programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      }
    );

    console.log(
      `Found ${response.value.length} token accounts related to collection`
    );

    // Method 2: Use getProgramAccounts to find all token accounts with this mint
    const allTokenAccounts = await connection.getProgramAccounts(
      new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      {
        filters: [
          {
            dataSize: 165, // Token account data size
          },
          {
            memcmp: {
              offset: 0, // Mint address is at offset 0
              bytes: collectionMint.toBase58(),
            },
          },
        ],
      }
    );

    console.log(
      `Found ${allTokenAccounts.length} total token accounts for this collection`
    );

    const nftHolders = [];
    for (const { pubkey, account } of allTokenAccounts) {
      try {
        const parsedData = await connection.getParsedAccountInfo(pubkey);
        if (parsedData.value?.data && "parsed" in parsedData.value.data) {
          const tokenInfo = parsedData.value.data.parsed.info;
          if (tokenInfo.tokenAmount.amount === "1") {
            // NFTs have amount of 1
            nftHolders.push({
              tokenAccount: pubkey.toBase58(),
              owner: tokenInfo.owner,
              mint: tokenInfo.mint,
            });
          }
        }
      } catch (error) {
        // Skip if we can't parse this account
      }
    }

    return nftHolders;
  } catch (error) {
    console.error("Error fetching NFTs from collection:", error);
    return [];
  }
}

async function getNFTsFromCandyMachine(
  connection: Connection,
  candyMachineId: string
) {
  try {
    console.log("\n🍭 Fetching NFTs from Candy Machine...");

    // This is a more complex query that would require the Metaplex SDK
    // For now, we'll return the cache data
    return [];
  } catch (error) {
    console.error("Error fetching NFTs from candy machine:", error);
    return [];
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
    for (const { account } of tokenAccounts.value) {
      const tokenInfo = account.data.parsed.info;
      // NFTs typically have decimals of 0 and amount of 1
      if (
        tokenInfo.tokenAmount.decimals === 0 &&
        tokenInfo.tokenAmount.amount === "1"
      ) {
        nfts.push({
          mint: tokenInfo.mint,
          tokenAccount: account.data.parsed.info.owner,
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

async function main() {
  const userKP = await loadKeypair();
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  console.log("🎨 NFT Collection Information");
  console.log("============================");
  console.log("👤 Your wallet:", userKP.publicKey.toBase58());

  // Load cache data
  const cacheData = await loadCacheFile();

  if (cacheData && cacheData.program) {
    console.log("\n📋 Collection Details from Cache:");
    console.log("🍭 Candy Machine ID:", cacheData.program.candyMachine);
    console.log("🏛️ Collection Mint:", cacheData.program.collectionMint);
    console.log(
      "👑 Collection Creator:",
      cacheData.program.candyMachineCreator
    );

    if (cacheData.program.candyGuard) {
      console.log("🛡️ Candy Guard:", cacheData.program.candyGuard);
    }

    // Verify collection mint exists on-chain
    try {
      const collectionMint = new PublicKey(cacheData.program.collectionMint);
      const mintInfo = await connection.getAccountInfo(collectionMint);

      if (mintInfo) {
        console.log("✅ Collection mint verified on-chain");

        // Try to get mint data
        try {
          const { getMint } = require("@solana/spl-token");
          const mintData = await getMint(connection, collectionMint);
          console.log("🔢 Collection Supply:", mintData.supply.toString());
          console.log(
            "🔐 Mint Authority:",
            mintData.mintAuthority?.toBase58() || "None"
          );
          console.log(
            "❄️ Freeze Authority:",
            mintData.freezeAuthority?.toBase58() || "None"
          );
        } catch (error) {
          console.log("⚠️ Could not fetch detailed mint data");
        }

        // Get all NFTs from this collection
        const collectionNFTs = await getAllNFTsFromCollection(
          connection,
          collectionMint
        );
        if (collectionNFTs.length > 0) {
          console.log(
            `\n🖼️ Found ${collectionNFTs.length} NFTs in collection:`
          );
          collectionNFTs.forEach((nft, index) => {
            console.log(`\n${index + 1}. NFT:`);
            console.log(`   Mint: ${nft.mint}`);
            console.log(`   Owner: ${nft.owner}`);
            console.log(`   Token Account: ${nft.tokenAccount}`);
          });
        }
      } else {
        console.log("❌ Collection mint not found on-chain");
      }
    } catch (error) {
      console.log("❌ Error verifying collection mint:", error);
    }

    // Get all NFTs owned by your wallet
    const userNFTs = await getAllNFTsByOwner(connection, userKP.publicKey);
    if (userNFTs.length > 0) {
      console.log(`\n👛 Your wallet owns ${userNFTs.length} NFTs:`);
      userNFTs.forEach((nft, index) => {
        console.log(`\n${index + 1}. NFT Mint: ${nft.mint}`);
      });
    }

    console.log("\n🎯 Your NFT Collection Address is:");
    console.log("📍", cacheData.program.collectionMint);

    console.log("\n📝 How to use this:");
    console.log("1. This is your collection mint address");
    console.log(
      "2. Individual NFTs minted from this collection will have different mint addresses"
    );
    console.log(
      "3. To get individual NFT mint addresses, use the mint-nft.ts script"
    );
    console.log("4. Each NFT you mint will have its own unique mint address");
  } else {
    console.log("❌ No cache.json found or invalid format");
    console.log("\n📋 Alternative methods to find your collection:");
    console.log("1. Check your Solana wallet for NFTs you own");
    console.log("2. Run: sugar show to see candy machine details");
    console.log("3. Check the Solana explorer for your wallet address");
  }

  // Show individual NFT items from cache if available
  if (cacheData && cacheData.items) {
    console.log("\n🖼️ Individual NFTs in your collection:");
    const itemKeys = Object.keys(cacheData.items).filter((key) => key !== "-1");
    console.log(`Total NFTs: ${itemKeys.length}`);

    // Show first few items as examples
    const sampleItems = itemKeys.slice(0, 3);
    sampleItems.forEach((key) => {
      const item = cacheData.items[key];
      console.log(`\n${item.name}:`);
      console.log(`  Metadata: ${item.metadata_link}`);
      console.log(`  Image: ${item.image_link}`);
      console.log(`  On-chain: ${item.onChain ? "✅" : "❌"}`);
    });

    if (itemKeys.length > 3) {
      console.log(`\n... and ${itemKeys.length - 3} more NFTs`);
    }
  }

  console.log("\n🔗 Useful Links:");
  if (cacheData?.program?.candyMachine) {
    console.log(
      `Candy Machine Explorer: https://www.solana.fm/address/${cacheData.program.candyMachine}?cluster=devnet-alpha`
    );
  }
  if (cacheData?.program?.collectionMint) {
    console.log(
      `Collection Mint Explorer: https://www.solana.fm/address/${cacheData.program.collectionMint}?cluster=devnet-alpha`
    );
  }
}

main().catch((err) => {
  console.error("❌ Script error:", err);
  process.exit(1);
});
