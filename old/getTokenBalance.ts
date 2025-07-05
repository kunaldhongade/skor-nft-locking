import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

async function main() {
  //   const [, , ownerAddr, mintAddr] = process.argv;

  const ownerAddr = "11111111111111111111111111111111";
  const mintAddr = "8CLGcTogo6FoYkEQQBm3Vm2PVckYCiCm3XXhdsr4skoR";
  if (!ownerAddr || !mintAddr) {
    process.exit(1);
  }

  const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");
  const owner = new PublicKey(ownerAddr);
  const mint = new PublicKey(mintAddr);

  // fetch all token‐accounts for this owner/mint
  const resp = await connection.getParsedTokenAccountsByOwner(owner, { mint });

  // sum up their uiAmount (already human‐readable)
  let balance = 0;
  for (const { account } of resp.value) {
    const info = (account.data as any).parsed.info.tokenAmount;
    // uiAmount may be fractional according to decimals
    balance += info.uiAmount || 0;
  }

  console.log(`Token balance of ${ownerAddr}`);
  console.log(`for mint ${mintAddr}`);
  console.log(`---- ${balance.toLocaleString()} tokens`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
