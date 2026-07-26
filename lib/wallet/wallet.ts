// Frictionless agent wallet — auto-generated, held in the browser (localStorage).
// Testnet-only convenience: the key never leaves the device. For real funds a
// user would import/secure their own key; this is the zero-friction default.
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const PK_KEY = "themis.wallet.pk";

export type Wallet = { address: `0x${string}` };

export function getOrCreateWallet(): Wallet {
  if (typeof window === "undefined") throw new Error("wallet is client-only");
  let pk = localStorage.getItem(PK_KEY) as `0x${string}` | null;
  if (!pk) {
    pk = generatePrivateKey();
    localStorage.setItem(PK_KEY, pk);
  }
  return { address: privateKeyToAccount(pk).address };
}

export function getWalletAddress(): `0x${string}` | null {
  if (typeof window === "undefined") return null;
  const pk = localStorage.getItem(PK_KEY) as `0x${string}` | null;
  return pk ? privateKeyToAccount(pk).address : null;
}

export function resetWallet(): void {
  if (typeof window !== "undefined") localStorage.removeItem(PK_KEY);
}
