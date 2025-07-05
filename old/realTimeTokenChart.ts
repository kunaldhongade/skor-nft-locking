import * as anchor from "@project-serum/anchor";
import { getMint } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import * as dotenv from "dotenv";
import { existsSync, mkdirSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { homedir } from "os";
import { resolve } from "path";

dotenv.config();

// === CONFIGURATION ===
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);
const MINT = new PublicKey(process.env.MINT!);
const SYMBOL = process.env.SYMBOL || "SKORAIUSDT";
const CIRCULATING_SUPPLY = Number(process.env.CIRCULATING_SUPPLY) || 26000000;
const CONFIG_SEED = "config";
const GLOBAL_STATS_SEED = "global_stats";
const USER_STATS_SEED = "user_stats";

// === INTERFACES ===
interface TickerResponse {
  symbol: string;
  price: string;
}

interface KlineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface GlobalStats {
  totalStaked: number;
  totalRewards: number;
  activeStakes: number;
  tierDistribution: Record<string, number>;
  durationDistribution: Record<string, number>;
  bump: number;
}

// === UTILITIES ===
function formatTokens(amount: number, divisor: number): number {
  return amount / divisor;
}

function formatDistribution(values: number[] | undefined, keys: string[]) {
  return keys.reduce((acc, key, i) => {
    acc[key] = values && values[i] !== undefined ? values[i] : 0;
    return acc;
  }, {} as Record<string, number>);
}

const TIER_LABELS = ["Bronze", "Silver", "Gold"];
const DURATION_LABELS = ["Sixty", "Ninety", "OneEighty", "ThreeSixtyFive"];

// === CORE FUNCTIONS ===
async function loadKeypair(): Promise<anchor.web3.Keypair> {
  const keypairPath = resolve(homedir(), ".config/solana/id.json");
  const secret = await readFile(keypairPath, "utf-8");
  return anchor.web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

async function fetchCurrentPrice(): Promise<number> {
  try {
    const response = await fetch(
      `https://api.mexc.com/api/v3/ticker/price?symbol=${SYMBOL}`
    );

    if (!response.ok) throw new Error(`Price API Error: ${response.status}`);

    const data = (await response.json()) as TickerResponse;
    return parseFloat(data.price);
  } catch (error) {
    console.error(
      "Failed to fetch price:",
      error instanceof Error ? error.message : error
    );
    return 0;
  }
}

async function fetchHistoricalData(): Promise<KlineData[]> {
  try {
    const response = await fetch(
      `https://api.mexc.com/api/v3/klines?symbol=${SYMBOL}&interval=1d&limit=30`
    );

    if (!response.ok)
      throw new Error(`Historical data error: ${response.status}`);

    const data = (await response.json()) as any[][];
    return data.map((k) => ({
      time: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
    }));
  } catch (error) {
    console.error(
      "Failed to fetch history:",
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

function renderCLIChart(data: KlineData[], currentPrice: number) {
  const CHART_WIDTH = 50;
  const CHART_HEIGHT = 10;

  // Price normalization
  const prices = data.map((d) => d.close);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;

  // Chart rendering
  const chart: string[][] = Array.from({ length: CHART_HEIGHT + 1 }, () =>
    Array(CHART_WIDTH).fill(" ")
  );

  const step = Math.floor(data.length / CHART_WIDTH);
  data.forEach((d, i) => {
    const x = Math.floor(i / step);
    if (x >= CHART_WIDTH) return;
    const yVal = ((d.close - minPrice) / priceRange) * CHART_HEIGHT;
    const y = CHART_HEIGHT - Math.round(yVal);
    if (y >= 0 && y <= CHART_HEIGHT) chart[y][x] = "█";
  });

  // Current price indicator
  const currentY =
    CHART_HEIGHT -
    Math.round(((currentPrice - minPrice) / priceRange) * CHART_HEIGHT);
  if (currentY >= 0 && currentY <= CHART_HEIGHT) {
    chart[currentY].fill("─");
    chart[currentY][Math.min(CHART_WIDTH - 1, Math.floor(data.length / step))] =
      "⬆";
  }

  //   console.log("\nPrice Chart (Last 30 Days):");
  //   console.log("┌" + "─".repeat(CHART_WIDTH) + "┐");
  //   chart.forEach((row) => console.log("│" + row.join("") + "│"));
  //   console.log("└" + "─".repeat(CHART_WIDTH) + "┘");
  console.log(`▲ Current Price: $${currentPrice.toFixed(6)}`);
  console.log(`├ Min: $${minPrice.toFixed(6)}  ┴ Max: $${maxPrice.toFixed(6)}`);
}

async function getGlobalStats(
  program: anchor.Program,
  decimals: number
): Promise<GlobalStats> {
  const [globalStatsPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(GLOBAL_STATS_SEED)],
    program.programId
  );

  const rawStats = await program.methods
    .getGlobalStats()
    .accounts({ globalStats: globalStatsPDA })
    .view();

  const divisor = 10 ** decimals;

  return {
    totalStaked: formatTokens(Number(rawStats.totalStaked), divisor),
    totalRewards: formatTokens(Number(rawStats.totalRewards), divisor),
    activeStakes: rawStats.activeStakes,
    tierDistribution: formatDistribution(
      rawStats.tierDistribution,
      TIER_LABELS
    ),
    durationDistribution: formatDistribution(
      rawStats.durationDistribution,
      DURATION_LABELS
    ),
    bump: rawStats.bump,
  };
}

// === MAIN EXECUTION ===
async function main() {
  // Initialize Solana connection
  const payer = await loadKeypair();
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const wallet = new anchor.Wallet(payer);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Load program and market data
  const [currentPrice, idl] = await Promise.all([
    fetchCurrentPrice(),
    (async () => {
      const idlPath = resolve(__dirname, "../target/idl/skorstaking.json");
      return JSON.parse(await readFile(idlPath, "utf8"));
    })(),
  ]);

  const program = new anchor.Program(idl, PROGRAM_ID, provider);
  const mintInfo = await getMint(connection, MINT);

  // Fetch and process data
  const [globalStats, historicalData] = await Promise.all([
    getGlobalStats(program, mintInfo.decimals),
    fetchHistoricalData(),
  ]);

  // Calculate financial metrics
  const tvl = globalStats.totalStaked * currentPrice;
  const marketCap = currentPrice * CIRCULATING_SUPPLY;

  // Display dashboard
  console.log("\n📊 SKORAI Financial Dashboard");
  console.log("============================");
  console.log("💰 Price Data");
  console.log(`  Current Price: $${currentPrice.toFixed(6)}`);
  console.log(
    `  Market Cap: $${marketCap.toLocaleString()} (${CIRCULATING_SUPPLY.toLocaleString()} tokens)`
  );

  console.log("\n🔒 Staking Metrics");
  console.log(`  Total Value Locked: $${tvl.toLocaleString()}`);
  console.log(
    `  Total Staked: ${globalStats.totalStaked.toLocaleString()} SKORAI`
  );
  console.log(`  Active Stakes: ${globalStats.activeStakes}`);

  console.log("\n📈 Distribution Analysis");
  console.log("  Tier Distribution:", globalStats.tierDistribution);
  console.log("  Duration Distribution:", globalStats.durationDistribution);

  // Render price chart
  if (historicalData.length > 0) {
    renderCLIChart(historicalData, currentPrice);
  }

  // Save data
  const outDir = resolve(__dirname, "../data");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  await Promise.all([
    writeFile(
      resolve(outDir, "globalStats.json"),
      JSON.stringify(globalStats, null, 2)
    ),
    writeFile(
      resolve(outDir, "priceData.json"),
      JSON.stringify(
        {
          currentPrice,
          marketCap,
          circulatingSupply: CIRCULATING_SUPPLY,
          historicalData,
        },
        null,
        2
      )
    ),
  ]);

  console.log("\n✅ Data saved to /data directory");
}

main().catch((err) => {
  console.error("Runtime error:", err);
  process.exit(1);
});
