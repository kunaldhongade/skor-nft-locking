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

const getTierName = (tier: any) => {
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
  return map[Math.round(days)] ?? `${days}Days`;
};

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

  const mint = new PublicKey(MINT);
  const mintInfo = await getMint(connection, mint);
  const decimals = mintInfo.decimals;
  const divisor = 10 ** decimals;

  const accounts = await connection.getProgramAccounts(programId, {
    filters: [{ dataSize: 8 + 32 + 8 + 8 + 8 + 8 + 1 + 1 + 8 }],
  });

  console.log(`📦 Found ${accounts.length} stake accounts`);

  const userStats: Record<string, any> = {};

  for (const { pubkey } of accounts) {
    try {
      const stake = await program.account.stakeAccount.fetch(pubkey);
      // @ts-ignore
      const staker = stake.staker.toBase58();
      // @ts-ignore
      const days = stake.duration.toNumber() / (60 * 60 * 24);
      // @ts-ignore
      const tier = getTierName(stake.tier);
      const durationLabel = getDurationLabel(days);

      if (!userStats[staker]) {
        userStats[staker] = {
          totalStaked: 0,
          totalRewards: 0,
          activeStakes: 0,
          tierDistribution: {},
          durationDistribution: {},
        };
      }

      const user = userStats[staker];
      // @ts-ignore
      user.totalStaked += stake.depositAmount.toNumber();
      // @ts-ignore
      user.totalRewards += stake.rewardAmount.toNumber();
      // @ts-ignore
      if (!stake.claimed) {
        user.activeStakes += 1;
      }

      user.tierDistribution[tier] = (user.tierDistribution[tier] || 0) + 1;
      user.durationDistribution[durationLabel] =
        (user.durationDistribution[durationLabel] || 0) + 1;
    } catch (e: any) {
      console.error(`❌ Failed to decode ${pubkey.toBase58()}:`, e.message);
    }
  }

  // Print results
  console.log(`\n📊 User-wise staking stats:\n`);
  for (const [user, stats] of Object.entries(userStats)) {
    console.log(`${user}:`);
    console.log({
      totalStaked: Number((stats.totalStaked / divisor).toFixed(decimals)),
      totalRewards: Number((stats.totalRewards / divisor).toFixed(decimals)),
      activeStakes: stats.activeStakes,
      tierDistribution: stats.tierDistribution,
      durationDistribution: stats.durationDistribution,
    });
    console.log("—".repeat(40));
  }
};

main().catch((err) => {
  console.error("❌ Script error:", err);
  process.exit(1);
});
