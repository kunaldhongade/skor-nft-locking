import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

interface AWSConfig {
  bucket: string;
  profile: string;
  directory: string;
  region: string;
}

async function checkAWSCredentials() {
  try {
    console.log("🔍 Checking AWS credentials...");
    execSync("aws sts get-caller-identity", { stdio: "pipe" });
    console.log("✅ AWS credentials are configured");
    return true;
  } catch (error) {
    console.log("❌ AWS credentials not found or invalid");
    console.log("📋 Please configure AWS credentials:");
    console.log("1. Run: aws configure");
    console.log("2. Enter your AWS Access Key ID");
    console.log("3. Enter your AWS Secret Access Key");
    console.log("4. Enter your default region (e.g., eu-west-1)");
    console.log("5. Enter your output format (json)");
    return false;
  }
}

async function checkS3Bucket(bucketName: string) {
  try {
    console.log(`🔍 Checking S3 bucket: ${bucketName}`);
    execSync(`aws s3 ls s3://${bucketName}`, { stdio: "pipe" });
    console.log(`✅ S3 bucket ${bucketName} exists and is accessible`);
    return true;
  } catch (error) {
    console.log(
      `❌ S3 bucket ${bucketName} does not exist or is not accessible`
    );
    console.log(`📋 Please create the bucket: aws s3 mb s3://${bucketName}`);
    return false;
  }
}

async function uploadAssetsToS3() {
  const assetsDir = path.join(__dirname, "..", "assets");
  const bucketName = "skor-metadata";

  console.log("📤 Uploading assets to S3...");

  try {
    // Upload PNG files
    const pngFiles = fs
      .readdirSync(assetsDir)
      .filter((file) => file.endsWith(".png"));

    for (const file of pngFiles) {
      const localPath = path.join(assetsDir, file);
      const s3Path = `s3://${bucketName}/assets/${file}`;

      console.log(`📤 Uploading ${file}...`);
      execSync(`aws s3 cp "${localPath}" "${s3Path}" --acl public-read`);
    }

    console.log("✅ All assets uploaded to S3 successfully!");
  } catch (error) {
    console.error("❌ Error uploading assets to S3:", error);
    throw error;
  }
}

async function deployWithSugar() {
  console.log("🚀 Deploying with Sugar CLI...");

  try {
    // Upload metadata
    console.log("📤 Uploading metadata...");
    execSync("sugar upload", { stdio: "inherit" });

    // Deploy candy machine
    console.log("🏗️ Deploying candy machine...");
    execSync("sugar deploy", { stdio: "inherit" });

    console.log("✅ Deployment completed successfully!");
  } catch (error) {
    console.error("❌ Error during deployment:", error);
    throw error;
  }
}

async function main() {
  console.log("🚀 Starting AWS deployment process...\n");

  // Check AWS credentials
  const hasCredentials = await checkAWSCredentials();
  if (!hasCredentials) {
    console.log("\n❌ Please configure AWS credentials first");
    process.exit(1);
  }

  // Check S3 bucket
  const bucketExists = await checkS3Bucket("skor-metadata");
  if (!bucketExists) {
    console.log("\n❌ Please create the S3 bucket first");
    process.exit(1);
  }

  // Upload assets to S3
  await uploadAssetsToS3();

  // Deploy with Sugar
  await deployWithSugar();

  console.log("\n🎉 Deployment completed successfully!");
  console.log("\n📋 Next steps:");
  console.log("1. Test your candy machine");
  console.log("2. Mint a test NFT");
  console.log("3. Verify metadata on marketplaces");
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});
