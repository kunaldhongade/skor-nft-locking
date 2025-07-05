import { getMint } from "@solana/spl-token";
import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import csv from "csv-parser";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");
  //   const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  const MINT_ADDRESS = "8CLGcTogo6FoYkEQQBm3Vm2PVckYCiCm3XXhdsr4skoR";
  const mintPubkey = new PublicKey(MINT_ADDRESS);
  const CREATOR_ADDRESS = "8C4LnpU7gaUdeyvrUkRqkjRCE7xFjTLkVss1UFiPRmXw";

  const mint = await getMint(connection, mintPubkey);
  const totalSupplyRaw = mint.supply;
  const creator = CREATOR_ADDRESS;
  const decimals = mint.decimals;
  const totalSupply = Number(totalSupplyRaw) / 10 ** decimals;
  const tlvData = mint.tlvData;
  const mintAuthority = mint.mintAuthority;
  const freezeAuthority = mint.freezeAuthority;
  console.log(`Creator Address: ${creator}`);
  console.log(`Mint Address: ${mintPubkey.toBase58()}`);
  console.log(`Total supply: ${totalSupply.toLocaleString()} tokens`);
  console.log(`Mint Authority: ${mintAuthority}`);
  console.log(`Freeze Authority: ${freezeAuthority}`);
  console.log(`Decimals: ${decimals}`);
  console.log(`TLV Data: ${tlvData}`);

  const excludedAddresses = ["9U9Bb9WRY7Ue4gBswmXM7nJmaAD3WpEmGNEzsZXgSstZ"]; // UNUSED Tokens

  const HolderAccounts = [
    "8C4LnpU7gaUdeyvrUkRqkjRCE7xFjTLkVss1UFiPRmXw",
    "ASTyfSima4LLAdDgoFGkgqoKowG1LZFDr9fAQrg7iaJZ",
    "3DG4mBHrrq2nbEJS2gFT4qBbfi3cNnMQwYeb3QNp1578",
    "56CEsLyQAU655z7xVmM8rqJfCoRKsdgiWdp75uAJqHa7",
    "He1B6KDX8xiabucySud1j1VDbMfbyZMCyU5reospoK6d",
  ];

  let totalCirculatingSupply = 0;

  // for (const holder of HolderAccounts) {
  //   await new Promise((resolve) => setTimeout(resolve, 500)); // Delay each request by 500 ms
  //   const resp = await connection.getParsedTokenAccountsByOwner(
  //     new PublicKey(holder),
  //     {
  //       mint: mintPubkey,
  //     }
  //   );

  //   // Sum up their uiAmount (already human‐readable)
  //   let holderBalance = 0;
  //   for (const { account } of resp.value) {
  //     const info = (account.data as any).parsed.info.tokenAmount;
  //     // uiAmount may be fractional according to decimals
  //     holderBalance += info.uiAmount || 0;
  //   }

  //   console.log(`Holder: ${holder}, Balance: ${holderBalance}`);
  //   totalCirculatingSupply += holderBalance;
  // }

  const csvFilePath = path.resolve(
    __dirname,
    "../data/export_token_holders_8CLGcTogo6FoYkEQQBm3Vm2PVckYCiCm3XXhdsr4skoR_1745649987037.csv"
  );

  const csvData: { Account: string; Quantity: number }[] = [];

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on("data", (row) => {
        const quantity = parseFloat(row.Quantity);
        if (!isNaN(quantity)) {
          csvData.push({
            Account: row.address,
            Quantity: quantity,
          });
        }
      })
      .on("end", resolve)
      .on("error", reject);
  });

  console.log(`Total number of holders: ${csvData.length}`);
  console.log(
    `Total number of excluded addresses: ${excludedAddresses.length}`
  );
  let excludedBalance = 0;

  for (const excluded of excludedAddresses) {
    const resp = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(excluded),
      {
        mint: mintPubkey,
      }
    );

    for (const { account } of resp.value) {
      const info = (account.data as any).parsed.info.tokenAmount;
      excludedBalance += info.uiAmount || 0;
    }

    console.log(`Excluded Address: ${excluded}, Balance: ${excludedBalance}`);
  }

  for (const holder of csvData) {
    if (!excludedAddresses.some((excluded) => excluded === holder.Account)) {
      totalCirculatingSupply += holder.Quantity;
    }
  }
  totalCirculatingSupply -= excludedBalance;

  console.log(
    `Total Circulating Supply: ${totalCirculatingSupply.toLocaleString()} tokens`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
