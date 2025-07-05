import * as anchor from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import * as dotenv from "dotenv";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { resolve } from "path";

dotenv.config();

// === CONFIG & SEEDS ===
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);
const MINT = new PublicKey(process.env.MINT!);
const VAULT_AUTH_SEED = "vault_authority";
const FUND_AMOUNT_WHOLE = new anchor.BN(process.env.FUND_AMOUNT_WHOLE!);

/**
 * Load local Solana CLI keypair (~/.config/solana/id.json)
 */
async function loadKeypair(): Promise<anchor.web3.Keypair> {
  const p = resolve(homedir(), ".config/solana/mainnet-wallet.json");

  const secret = await readFile(p, "utf-8");
  return anchor.web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

async function main() {
  const funderKP = await loadKeypair();
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  const wallet = new anchor.Wallet(funderKP);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  // --- Derive PDAs & ATAs ---
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_AUTH_SEED)],
    PROGRAM_ID
  );

  const funderTokenAccount = getAssociatedTokenAddressSync(
    MINT,
    funderKP.publicKey
  );
  const rewardsTokenAccount = getAssociatedTokenAddressSync(
    MINT,
    vaultAuthority,
    true
  );

  console.log("🏦 Vault Authority PDA:", vaultAuthority.toBase58());
  console.log("📥 Funder ATA:", funderTokenAccount.toBase58());
  console.log("🎁 Rewards ATA:", rewardsTokenAccount.toBase58());

  // --- Ensure ATAs exist ---
  const ataTx = new Transaction();
  try {
    await getAccount(connection, funderTokenAccount);
  } catch {
    console.log("🔧 Creating funder ATA…");
    ataTx.add(
      createAssociatedTokenAccountInstruction(
        funderKP.publicKey,
        funderTokenAccount,
        funderKP.publicKey,
        MINT
      )
    );
  }

  try {
    await getAccount(connection, rewardsTokenAccount);
  } catch {
    console.log("🔧 Creating rewards ATA for vault…");
    ataTx.add(
      createAssociatedTokenAccountInstruction(
        funderKP.publicKey,
        rewardsTokenAccount,
        vaultAuthority,
        MINT
      )
    );
  }

  if (ataTx.instructions.length > 0) {
    const sig = await sendAndConfirmTransaction(connection, ataTx, [funderKP]);
    console.log("✅ ATA(s) created:", sig);
  }

  // --- Fetch mint info & compute base amount ---
  const mintInfo = await getMint(connection, MINT);
  const decimals = mintInfo.decimals;
  const amountBase = FUND_AMOUNT_WHOLE.mul(
    new anchor.BN(10).pow(new anchor.BN(decimals))
  );

  // --- Check funder balance ---
  const funderAcct = await getAccount(connection, funderTokenAccount);
  const balance = Number(funderAcct.amount) / 10 ** decimals;
  console.log(`🧾 Funder token balance: ${balance} tokens`);  if (funderAcct.amount < amountBase.toNumber()) {
    console.log("⚠️ Not enough tokens. Minting to funder ATA...");
    const mintTx = new Transaction().add(
      createMintToInstruction(
        MINT,
        funderTokenAccount,
        funderKP.publicKey,
        amountBase.toNumber()
      )
    );
    await sendAndConfirmTransaction(connection, mintTx, [funderKP]);
    console.log(`✅ Minted tokens to funder ATA`);
  }

  // --- Transfer tokens to vault/rewards ATA ---
  console.log("🔁 Transferring tokens to vault...");
  const transferTx = new Transaction().add(
    createTransferInstruction(
      funderTokenAccount,
      rewardsTokenAccount,
      funderKP.publicKey,
      amountBase.toNumber()
    )
  );
  const sig = await sendAndConfirmTransaction(connection, transferTx, [
    funderKP,
  ]);
  console.log("✅ Vault funded. Tx:", sig);
}

main().catch((err) => {
  console.error("❌ Script error:", err);
  process.exit(1);
});
