import { readdir, readFile, writeFile } from "fs/promises";
import { resolve } from "path";

async function fixMetadataSymbol() {
  const assetsDir = resolve(__dirname, "../assets");

  try {
    // Read all JSON files in assets directory
    const files = await readdir(assetsDir);
    const jsonFiles = files.filter((file) => file.endsWith(".json"));

    console.log(`Found ${jsonFiles.length} JSON files to update`);

    for (const file of jsonFiles) {
      const filePath = resolve(assetsDir, file);
      const content = await readFile(filePath, "utf-8");
      const metadata = JSON.parse(content);

      // Update symbol from "NUMBERS" to "NB"
      if (metadata.symbol === "NUMBERS") {
        metadata.symbol = "NB";
        await writeFile(filePath, JSON.stringify(metadata, null, 2));
        console.log(`✅ Updated ${file}`);
      } else {
        console.log(
          `⏭️  Skipped ${file} (symbol already correct or different)`
        );
      }
    }

    console.log("\n🎉 All metadata files updated successfully!");
    console.log("You can now run: sugar launch");
  } catch (error) {
    console.error("❌ Error updating metadata files:", error);
  }
}

fixMetadataSymbol().catch(console.error);
