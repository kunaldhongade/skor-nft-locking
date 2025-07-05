import * as anchor from "@coral-xyz/anchor";
import { getMint } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import * as dotenv from "dotenv";
import { existsSync, mkdirSync } from "fs";
import { readFile, rm } from "fs/promises";
import { resolve as resolvePath } from "path";
import * as XLSX from "xlsx";

dotenv.config();

const RPC_URL = "https://api.devnet.solana.com";
const PROGRAM_ID = process.env.PROGRAM_ID!;

function getTierName(tier: any): string {
  if ("bronze" in tier) return "Bronze";
  if ("silver" in tier) return "Silver";
  if ("gold" in tier) return "Gold";
  return "Unknown";
}

function getDurationLabel(days: number): string {
  const labels: Record<number, string> = {
    60: "Sixty",
    90: "Ninety",
    180: "OneEighty",
    365: "ThreeSixtyFive",
  };
  return labels[Math.round(days)] ?? `${days.toFixed(0)}Days`;
}

const main = async () => {
  // Setup
  const connection = new Connection(RPC_URL, "confirmed");
  const programId = new PublicKey(PROGRAM_ID);
  const idlPath = resolvePath(__dirname, "../target/idl/skorstaking.json");

  // Prepare output path
  const dataFolder = resolvePath(__dirname, "../data");
  const filePath = resolvePath(dataFolder, "stake_accounts.xlsx");
  mkdirSync(dataFolder, { recursive: true });
  if (existsSync(filePath)) {
    console.log("🗑 Removing old Excel file...");
    await rm(filePath);
  }

  // Load IDL & program
  const idlRaw = await readFile(idlPath, "utf-8");
  const idl = JSON.parse(idlRaw);
  const provider = new anchor.AnchorProvider(connection, {} as any, {
    preflightCommitment: "confirmed",
  });
  const program = new anchor.Program(idl, programId, provider);

  // Fetch mint decimals
  const mint = new PublicKey(process.env.MINT!);
  const mintInfo = await getMint(connection, mint);
  const decimals = mintInfo.decimals;
  const divisor = 10 ** decimals;
  console.log(`🔢 Mint decimals: ${decimals}, divisor: ${divisor}`);

  // Fetch stake accounts
  const accounts = await connection.getProgramAccounts(programId, {
    filters: [{ dataSize: 8 + 32 + 8 + 8 + 8 + 8 + 1 + 1 + 8 }],
  });
  console.log(`📦 Found ${accounts.length} stake accounts`);

  // Build rows
  const rows: any[] = [];
  for (const { pubkey } of accounts) {
    try {
      const stake = (await program.account.stakeAccount.fetch(pubkey)) as any;
      const days = stake.duration.toNumber() / (60 * 60 * 24);
      rows.push({
        StakeAccount: pubkey.toBase58(),
        Staker: stake.staker.toBase58(),
        Amount: (stake.depositAmount.toNumber() / divisor).toFixed(decimals),
        Reward: (stake.rewardAmount.toNumber() / divisor).toFixed(decimals),
        DurationSecs: stake.duration.toNumber(),
        DurationDays: days.toFixed(2),
        DurationLabel: getDurationLabel(days),
        APYRate: (
          (stake.rewardAmount.toNumber() / stake.depositAmount.toNumber()) *
          (365 / days) *
          100
        ).toFixed(2),
        Claimed: stake.claimed,
        Index: stake.index.toNumber(),
        Tier: getTierName(stake.tier),
      });
    } catch (e: any) {
      console.error(`❌ Decode failed for ${pubkey.toBase58()}:`, e.message);
    }
  }

  // Write Excel
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "StakeAccounts");
  XLSX.writeFile(wb, filePath);
  console.log(`✅ Data exported to: ${filePath}`);
};

main().catch((err) => {
  console.error("❌ Script error:", err);
  process.exit(1);
});
