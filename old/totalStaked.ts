import * as anchor from "@coral-xyz/anchor";
import { getMint } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import * as dotenv from "dotenv";
import { readFile } from "fs/promises";
import { resolve as resolvePath } from "path";

dotenv.config();

const RPC_URL = "https://api.devnet.solana.com";
const PROGRAM_ID = process.env.PROGRAM_ID!;
const MINT = process.env.MINT!;

const main = async () => {
  const connection = new Connection(RPC_URL, "confirmed");
  const programId = new PublicKey(PROGRAM_ID);

  const idlPath = resolvePath(__dirname, "../target/idl/skorstaking.json");
  const idlRaw = await readFile(idlPath, "utf-8");
  const idl = JSON.parse(idlRaw);

  const provider = new anchor.AnchorProvider(connection, {} as any, {
    preflightCommitment: "confirmed",
  });
  const program = new anchor.Program(idl, programId, provider);

  // Get mint info
  const mint = new PublicKey(MINT);
  const mintInfo = await getMint(connection, mint);
  const decimals = mintInfo.decimals;
  const divisor = 10 ** decimals;

  const accounts = await connection.getProgramAccounts(programId, {
    filters: [{ dataSize: 8 + 32 + 8 + 8 + 8 + 8 + 1 + 1 + 8 }],
  });

  console.log(`📦 Found ${accounts.length} stake accounts`);

  let totalStaked = 0;

  for (const { pubkey } of accounts) {
    try {
      const stake = await program.account.stakeAccount.fetch(pubkey);
      // @ts-ignore
      totalStaked += stake.depositAmount.toNumber();
    } catch (e: any) {
      console.error(`❌ Failed to decode ${pubkey.toBase58()}:`, e.message);
    }
  }

  console.log(
    `\n🧮 Total Staked: ${(totalStaked / divisor).toFixed(decimals)} tokens`
  );
};

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
