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

const getTierName = (tier: any): string => {
  if ("bronze" in tier) return "Bronze";
  if ("silver" in tier) return "Silver";
  if ("gold" in tier) return "Gold";
  return "Unknown";
};

const getDurationLabel = (days: number): string => {
  const map: Record<number, string> = {
    60: "Sixty",
    90: "Ninety",
    180: "OneEighty",
    365: "ThreeSixtyFive",
  };
  return map[days] || `${days}Days`;
};

const main = async () => {
  const connection = new Connection(RPC_URL, "confirmed");
  const programId = new PublicKey(PROGRAM_ID);
  const mint = new PublicKey(MINT);

  const idlPath = resolvePath(__dirname, "../target/idl/skorstaking.json");
  const idlRaw = await readFile(idlPath, "utf-8");
  const idl = JSON.parse(idlRaw);

  const provider = new anchor.AnchorProvider(connection, {} as any, {
    preflightCommitment: "confirmed",
  });
  const program = new anchor.Program(idl, programId, provider);

  const mintInfo = await getMint(connection, mint);
  const decimals = mintInfo.decimals;
  const divisor = 10 ** decimals;

  const accounts = await connection.getProgramAccounts(programId, {
    filters: [{ dataSize: 8 + 32 + 8 + 8 + 8 + 8 + 1 + 1 + 8 }],
  });

  let totalStaked = 0;
  let totalRewards = 0;
  let activeStakes = 0;
  const tierDistribution: Record<string, number> = {};
  const durationDistribution: Record<string, number> = {};

  for (const { pubkey } of accounts) {
    try {
      const stake: any = await program.account.stakeAccount.fetch(pubkey);
      const tier = getTierName(stake.tier);
      const durationDays = stake.duration.toNumber() / 86400;
      const durationLabel = getDurationLabel(durationDays);

      totalStaked += stake.depositAmount.toNumber();
      totalRewards += stake.rewardAmount.toNumber();

      if (!stake.claimed) activeStakes++;

      tierDistribution[tier] = (tierDistribution[tier] || 0) + 1;
      durationDistribution[durationLabel] =
        (durationDistribution[durationLabel] || 0) + 1;
    } catch (e: any) {
      console.error(`❌ Failed to decode ${pubkey.toBase58()}:`, e.message);
    }
  }

  console.log("\n📊 Staking Stats Summary:");
  console.log("Total Staked:", (totalStaked / divisor).toFixed(decimals));
  console.log("Total Rewards:", (totalRewards / divisor).toFixed(decimals));
  console.log("Active Stakes:", activeStakes);
  console.log("Tier Distribution:", tierDistribution);
  console.log("Duration Distribution:", durationDistribution);
  console.log("Bump: 255");
};

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
