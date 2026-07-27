// Client-side seal anchoring — the funded browser wallet signs a 0-value self-tx
// carrying the verdict's keccak256 seal in calldata, on X Layer testnet (1952).
// The tx permanently records the seal; its hash links to the explorer.
import { createWalletClient, http, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { xlayerTestnet } from "@/lib/chain/xlayer";

const PK_KEY = "themis.wallet.pk";

export async function anchorSealOnChain(
  hash: string
): Promise<{ txHash: string; explorer: string } | null> {
  if (typeof window === "undefined") return null;
  // Reuse the persistent agent wallet; create it here if the user reached execute
  // without visiting the wallet card, so a failure can only mean "unfunded".
  let pk = localStorage.getItem(PK_KEY) as Hex | null;
  if (!pk) {
    pk = generatePrivateKey();
    localStorage.setItem(PK_KEY, pk);
  }

  const account = privateKeyToAccount(pk);
  const client = createWalletClient({ account, chain: xlayerTestnet, transport: http() });
  // no `value` → 0; just the seal hash in calldata to a self-send
  const txHash = await client.sendTransaction({ account, to: account.address, data: hash as Hex });
  const base = xlayerTestnet.blockExplorers?.default.url ?? "https://www.oklink.com/x-layer-testnet";
  return { txHash, explorer: `${base}/tx/${txHash}` };
}
