import * as anchor from "@coral-xyz/anchor";
import { getMint } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import * as dotenv from "dotenv";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { resolve } from "path";

dotenv.config();

// === CONFIG ===
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);
const MINT = new PublicKey(process.env.MINT!);

async function loadKeypair(): Promise<anchor.web3.Keypair> {
  const keypairPath = resolve(homedir(), ".config/solana/id.json");
  const secret = await readFile(keypairPath, "utf-8");
  return anchor.web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

const main = async () => {
  const keypair = await loadKeypair();
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  // fetch mint decimals
  const mintInfo = await getMint(connection, MINT);
  const decimals = mintInfo.decimals;
  const divisor = 10 ** decimals;
  console.log("🔢 Token Decimals:", decimals);

  const idlPath = resolve(__dirname, "../target/idl/skorstaking.json");
  let idlRaw: string;
  try {
    idlRaw = await readFile(idlPath, "utf-8");
  } catch (err: any) {
    console.error(`❌ Failed to read IDL at ${idlPath}:`, err.message);
    process.exit(1);
  }
  const idl = JSON.parse(idlRaw);
  const program = new anchor.Program(idl, PROGRAM_ID, provider);
  const user = wallet.publicKey;

  console.log(`🔍 Fetching stakes for user: ${user.toBase58()}`);

  // fetch all stake accounts for user
  const accounts = await program.account.stakeAccount.all([
    { memcmp: { offset: 8, bytes: user.toBase58() } },
  ]);

  if (accounts.length === 0) {
    console.log("📭 No stakes found for this user.");
    return;
  }

  console.log(`📦 Found ${accounts.length} stake(s):\n`);
  accounts.forEach(({ publicKey, account }, i) => {
    const stake = account as {
      depositAmount: anchor.BN;
      rewardAmount: anchor.BN;
      duration: anchor.BN;
      startTime: anchor.BN;
      claimed: boolean;
      tier: any;
    };

    const days = stake.duration.toNumber() / 86400;
    console.log(`----- [#${i + 1}] -----`);
    console.log("Stake Account:", publicKey.toBase58());
    console.log(
      "Staked:",
      (stake.depositAmount.toNumber() / divisor).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
      }),
      "tokens"
    );
    console.log(
      "Reward:",
      (stake.rewardAmount.toNumber() / divisor).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
      }),
      "tokens"
    );
    console.log("Duration:", days, "days");
    console.log("Tier:", stake.tier);
    console.log("Claimed:", stake.claimed ? "✅ Yes" : "❌ No");
    console.log(
      "Start:",
      new Date(stake.startTime.toNumber() * 1000).toLocaleString()
    );
    console.log(
      "Unlocks:",
      new Date(
        (stake.startTime.toNumber() + stake.duration.toNumber()) * 1000
      ).toLocaleString()
    );
    console.log("---------------------\n");
  });
};

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
