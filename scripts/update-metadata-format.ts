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

function generateNFTMetadata(tokenId: number): NFTMetadata {
  return {
    name: `Genesis Creator Agent NFT #${tokenId}`,
    symbol: "SKOR AI",
    description: "Powered by SKOR AI",
    seller_fee_basis_points: 500,
    image: `https://skor-nft-test-20250719135527.s3.eu-west-1.amazonaws.com/assets/collection.png`,
    animation_url: `https://skor-nft-test-20250719135527.s3.eu-west-1.amazonaws.com/assets/video.mp4`,
    external_url: "https://skoragents.ai/",
    attributes: [
      {
        trait_type: "Tier",
        value: "1",
      },
    ],
    properties: {
      files: [
        {
          uri: `https://skor-nft-test-20250719135527.s3.eu-west-1.amazonaws.com/assets/video.mp4`,
          type: "video/mp4",
        },
        {
          uri: `https://skor-nft-test-20250719135527.s3.eu-west-1.amazonaws.com/assets/collection.png`,
          type: "image/png",
        },
      ],
      category: "video",
    },
  };
}

async function updateAllMetadata() {
  const assetsDir = path.join(__dirname, "..", "assets");

  // Get all JSON files in assets directory (excluding collection.json)
  const files = fs
    .readdirSync(assetsDir)
    .filter((file) => file.endsWith(".json") && file !== "collection.json");

  console.log(`Found ${files.length} NFT metadata files to update`);

  for (const file of files) {
    const tokenId = parseInt(file.replace(".json", ""));
    const metadata = generateNFTMetadata(tokenId);

    const filePath = path.join(assetsDir, file);
    fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2));

    console.log(`✅ Updated ${file} for token #${tokenId}`);
  }

  console.log("\n🎉 All metadata files updated successfully!");
  console.log("\n📋 Next steps:");
  console.log("1. Configure AWS region: aws configure set region eu-west-1");
  console.log("2. Run: sugar upload");
  console.log("3. Run: sugar deploy");
}

updateAllMetadata().catch(console.error);
