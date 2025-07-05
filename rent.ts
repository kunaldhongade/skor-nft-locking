import { Connection } from "@solana/web3.js";
import { readFile } from "fs/promises";

async function getRentExemption(programSoPath: string) {
  const connection = new Connection("https://api.mainnet-beta.solana.com");
  const soBuffer = await readFile(programSoPath);
  const size = soBuffer.length;
  const rent = await connection.getMinimumBalanceForRentExemption(size);
  console.log(`Program size: ${size} bytes`);
  console.log(`Rent-exempt balance: ${rent} lamports (${rent / 1e9} SOL)`);
}

getRentExemption("target/deploy/skorstaking.so");