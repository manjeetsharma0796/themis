// Seal anchoring on X Layer. Records a verdict's keccak256 seal immutably by
// sending a 0-value self-transaction with the hash as calldata — no contract to
// deploy. Gated on ANCHOR_PRIVATE_KEY (a funded X Layer testnet key): live when
// set, cleanly skipped otherwise (paper mode, no link).
import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { xlayerTestnet } from "@/lib/chain/xlayer";

export function anchorEnabled(): boolean {
  return Boolean(process.env.ANCHOR_PRIVATE_KEY);
}

export async function anchorSeal(
  hash: Hex
): Promise<{ txHash: string; explorer: string } | null> {
  const pk = process.env.ANCHOR_PRIVATE_KEY as Hex | undefined;
  if (!pk) return null;
  try {
    const account = privateKeyToAccount(pk);
    const client = createWalletClient({ account, chain: xlayerTestnet, transport: http() });
    // 0-value self-tx; the seal hash lives permanently in the tx calldata.
    const txHash = await client.sendTransaction({ to: account.address, value: BigInt(0), data: hash });
    return {
      txHash,
      explorer: `${xlayerTestnet.blockExplorers.default.url}/tx/${txHash}`,
    };
  } catch {
    return null; // RPC / funding issue — don't block execution, just skip the anchor
  }
}
