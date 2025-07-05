import * as anchor from "@coral-xyz/anchor";
import {
  getExplorerLink,
  getKeypairFromEnvironment,
} from "@solana-developers/helpers";
import { burn, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import "dotenv/config";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { resolve } from "path";

const DEVNET_URL = clusterApiUrl("devnet");
const TOKEN_DECIMALS = 2;
const BURN_AMOUNT = 5;
// Substitute your token mint address
const TOKEN_MINT_ADDRESS = process.env.MINT;

const connection = new Connection(DEVNET_URL);

(async () => {
  try {
    async function loadKeypair(): Promise<anchor.web3.Keypair> {
      const keypairPath = resolve(homedir(), ".config/solana/id.json");
      const secret = await readFile(keypairPath, "utf-8");
      return anchor.web3.Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(secret))
      );
    }
    const user = await loadKeypair();
    console.log(`🔑 Loaded keypair. Public key: ${user.publicKey.toBase58()}`);

    const tokenMintAccount = new PublicKey(TOKEN_MINT_ADDRESS);

    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      user,
      tokenMintAccount,
      user.publicKey
    );

    const burnAmount = BURN_AMOUNT * 10 ** TOKEN_DECIMALS;

    const transactionSignature = await burn(
      connection,
      user,
      userTokenAccount.address,
      tokenMintAccount,
      user,
      burnAmount
    );

    const explorerLink = getExplorerLink(
      "transaction",
      transactionSignature,
      "devnet"
    );

    console.log(`✅ Burn Transaction: ${explorerLink}`);
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
})();
