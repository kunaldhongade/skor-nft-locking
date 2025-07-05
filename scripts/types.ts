import * as anchor from "@coral-xyz/anchor";

export interface LockAccount {
  owner: anchor.web3.PublicKey;
  nftMint: anchor.web3.PublicKey;
  startTime: anchor.BN;
  duration: anchor.BN;
  unlocked: boolean;
}

export type LockDuration =
  | { sixty: {} }
  | { ninety: {} }
  | { oneEighty: {} }
  | { threeSixtyFive: {} };
