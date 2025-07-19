import * as fs from "fs";
import * as path from "path";

interface NFTMetadata {
  name: string;
  symbol: string;
  description: string;
  seller_fee_basis_points: number;
  image: string;
  animation_url: string;
  external_url: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
  properties: {
    files: Array<{
      uri: string;
      type: string;
    }>;
    category: string;
  };
}

function generateUniqueNFTMetadata(tokenId: number): NFTMetadata {
  // Create unique image and video URLs for each NFT
  const imageUrl = `https://skor-nft-test-20250719135527.s3.eu-west-1.amazonaws.com/assets/nft-${tokenId}.png`;
  const videoUrl = `https://skor-nft-test-20250719135527.s3.eu-west-1.amazonaws.com/assets/nft-${tokenId}.mp4`;

  return {
    name: `Genesis Creator Agent NFT #${tokenId}`,
    symbol: "SKOR AI",
    description: "Powered by SKOR AI",
    seller_fee_basis_points: 500,
    image: imageUrl,
    animation_url: videoUrl,
    external_url: "https://skoragents.ai/",
    attributes: [
      {
        trait_type: "Tier",
        value: "1",
      },
      {
        trait_type: "Token ID",
        value: tokenId.toString(),
      },
    ],
    properties: {
      files: [
        {
          uri: videoUrl,
          type: "video/mp4",
        },
        {
          uri: imageUrl,
          type: "image/png",
        },
      ],
      category: "video",
    },
  };
}

async function createUniqueAssets() {
  const assetsDir = path.join(__dirname, "..", "assets");

  console.log("🎨 Creating unique assets for each NFT...");

  // Create unique PNG files for each NFT (copy collection.png with different names)
  for (let i = 0; i < 16; i++) {
    const sourcePath = path.join(assetsDir, "collection.png");
    const destPath = path.join(assetsDir, `nft-${i}.png`);

    // Copy the collection.png to create unique files
    fs.copyFileSync(sourcePath, destPath);
    console.log(`✅ Created nft-${i}.png`);
  }

  // Create unique MP4 files for each NFT (copy video.mp4 with different names)
  for (let i = 0; i < 16; i++) {
    const sourcePath = path.join(assetsDir, "video.mp4");
    const destPath = path.join(assetsDir, `nft-${i}.mp4`);

    // Copy the video.mp4 to create unique files
    fs.copyFileSync(sourcePath, destPath);
    console.log(`✅ Created nft-${i}.mp4`);
  }

  // Update metadata files with unique URLs
  const files = fs
    .readdirSync(assetsDir)
    .filter((file) => file.endsWith(".json") && file !== "collection.json");

  console.log(
    `\n📝 Updating ${files.length} metadata files with unique assets...`
  );

  for (const file of files) {
    const tokenId = parseInt(file.replace(".json", ""));
    const metadata = generateUniqueNFTMetadata(tokenId);

    const filePath = path.join(assetsDir, file);
    fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2));

    console.log(`✅ Updated ${file} for token #${tokenId}`);
  }

  console.log("\n🎉 All unique assets created successfully!");
  console.log("\n📋 Next steps:");
  console.log(
    "1. Upload unique assets to S3: npx ts-node scripts/upload-unique-assets.ts"
  );
  console.log("2. Upload metadata: sugar upload");
  console.log("3. Deploy new candy machine: sugar deploy");
}

createUniqueAssets().catch(console.error);
