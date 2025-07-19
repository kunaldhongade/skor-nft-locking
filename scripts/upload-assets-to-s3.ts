import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const BUCKET_NAME = "skor-nft-test-20250719135527";

async function uploadAssetsToS3() {
  const assetsDir = path.join(__dirname, "..", "assets");

  console.log(`📤 Uploading assets to S3 bucket: ${BUCKET_NAME}`);

  try {
    // Only upload the good assets: collection.png and video.mp4
    const goodAssets = ["collection.png", "video.mp4"];

    console.log(
      `Found ${goodAssets.length} assets to upload: ${goodAssets.join(", ")}`
    );

    for (const file of goodAssets) {
      const localPath = path.join(assetsDir, file);
      const s3Path = `s3://${BUCKET_NAME}/assets/${file}`;

      console.log(`📤 Uploading ${file}...`);
      execSync(`aws s3 cp "${localPath}" "${s3Path}"`, { stdio: "inherit" });
    }

    console.log("✅ All assets uploaded to S3 successfully!");

    // Set bucket policy to make objects public
    console.log("\n🔧 Setting bucket policy for public read access...");
    const bucketPolicy = {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "PublicReadGetObject",
          Effect: "Allow",
          Principal: "*",
          Action: "s3:GetObject",
          Resource: `arn:aws:s3:::${BUCKET_NAME}/*`,
        },
      ],
    };

    const policyFile = path.join(__dirname, "bucket-policy.json");
    fs.writeFileSync(policyFile, JSON.stringify(bucketPolicy, null, 2));

    execSync(
      `aws s3api put-bucket-policy --bucket ${BUCKET_NAME} --policy file://${policyFile}`,
      { stdio: "inherit" }
    );

    // Clean up policy file
    fs.unlinkSync(policyFile);

    // List the uploaded files
    console.log("\n📋 Verifying uploaded files:");
    execSync(`aws s3 ls s3://${BUCKET_NAME}/assets/`, { stdio: "inherit" });
  } catch (error) {
    console.error("❌ Error uploading assets to S3:", error);
    throw error;
  }
}

uploadAssetsToS3().catch(console.error);
