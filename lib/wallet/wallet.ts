// Frictionless agent wallet — auto-generated, held in the browser (localStorage).
// Testnet-only convenience: the key never leaves the device. For real funds a
// user would import/secure their own key; this is the zero-friction default.
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const PK_KEY = "themis.wallet.pk";
const MAP_KEY = "themis.wallet.mappedTo"; // the user wallet this agent is synced to

export type Wallet = { address: `0x${string}` };

/** Install a specific agent key (e.g. one derived from the user's wallet), and
 *  record which user wallet it maps to. Returns the agent address. */
export function setAgentKey(pk: `0x${string}`, mappedTo?: string): `0x${string}` {
  if (typeof window !== "undefined") {
    localStorage.setItem(PK_KEY, pk);
    if (mappedTo) localStorage.setItem(MAP_KEY, mappedTo);
    else localStorage.removeItem(MAP_KEY);
  }
  return privateKeyToAccount(pk).address;
}

/** The user wallet this agent wallet was derived from, if any (else it's device-local). */
export function getMappedAddress(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(MAP_KEY) : null;
}

/** Disconnect: forget the OKX mapping but keep the agent wallet (and its positions). */
export function clearMapping(): void {
  if (typeof window !== "undefined") localStorage.removeItem(MAP_KEY);
}

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
  if (typeof window !== "undefined") {
    localStorage.removeItem(PK_KEY);
    localStorage.removeItem(MAP_KEY);
  }
}
