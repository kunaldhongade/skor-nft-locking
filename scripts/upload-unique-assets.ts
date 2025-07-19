import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const BUCKET_NAME = "skor-nft-test-20250719135527";

async function uploadUniqueAssets() {
  const assetsDir = path.join(__dirname, "..", "assets");

  console.log(`📤 Uploading unique assets to S3 bucket: ${BUCKET_NAME}`);

  try {
    // Get all unique PNG and MP4 files
    const pngFiles = fs
      .readdirSync(assetsDir)
      .filter((file) => file.startsWith("nft-") && file.endsWith(".png"));
    const mp4Files = fs
      .readdirSync(assetsDir)
      .filter((file) => file.startsWith("nft-") && file.endsWith(".mp4"));

    console.log(
      `Found ${pngFiles.length} PNG files and ${mp4Files.length} MP4 files to upload`
    );

    // Upload PNG files
    for (const file of pngFiles) {
      const localPath = path.join(assetsDir, file);
      const s3Path = `s3://${BUCKET_NAME}/assets/${file}`;

      console.log(`📤 Uploading ${file}...`);
      execSync(`aws s3 cp "${localPath}" "${s3Path}"`, { stdio: "inherit" });
    }

    // Upload MP4 files
    for (const file of mp4Files) {
      const localPath = path.join(assetsDir, file);
      const s3Path = `s3://${BUCKET_NAME}/assets/${file}`;

      console.log(`📤 Uploading ${file}...`);
      execSync(`aws s3 cp "${localPath}" "${s3Path}"`, { stdio: "inherit" });
    }

    console.log("✅ All unique assets uploaded to S3 successfully!");

    // List the uploaded files
    console.log("\n📋 Verifying uploaded files:");
    execSync(`aws s3 ls s3://${BUCKET_NAME}/assets/`, { stdio: "inherit" });
  } catch (error) {
    console.error("❌ Error uploading assets to S3:", error);
    throw error;
  }
}

uploadUniqueAssets().catch(console.error);
