// Connect an external OKX Wallet (or any injected EIP-1193 wallet) and switch it
// to X Layer testnet (1952). Complements the auto-created in-browser wallet.
"use client";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
};

export function getInjected(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { okxwallet?: Eip1193; ethereum?: Eip1193 };
  return w.okxwallet ?? w.ethereum ?? null;
}

const XLAYER_PARAMS = {
  chainId: "0x7a0", // 1952
  chainName: "X Layer testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: ["https://testrpc.xlayer.tech"],
  blockExplorerUrls: ["https://www.oklink.com/x-layer-testnet"],
};

export async function connectOkx(): Promise<{ address: string } | { error: string }> {
  const p = getInjected();
  if (!p) return { error: "no-wallet" };
  try {
    const accounts = (await p.request({ method: "eth_requestAccounts" })) as string[];
    const address = accounts?.[0];
    if (!address) return { error: "no account returned" };
    // Ensure the wallet is on X Layer testnet (switch, else add).
    try {
      await p.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: XLAYER_PARAMS.chainId }],
      });
    } catch {
      try {
        await p.request({ method: "wallet_addEthereumChain", params: [XLAYER_PARAMS] });
      } catch {
        /* user may decline the network add — still connected */
      }
    }
    return { address };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "connection rejected" };
  }
}
