// Connect an external OKX Wallet (or any injected EIP-1193 wallet) and switch it
// to X Layer testnet (1952). Can also *derive* the agent wallet from the user's
// wallet so the same agent follows them across devices.
"use client";

import { keccak256, type Hex } from "viem";
import { setAgentKey } from "@/lib/wallet/wallet";

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

async function ensureXLayer(p: Eip1193): Promise<void> {
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
}

export async function connectOkx(): Promise<{ address: string } | { error: string }> {
  const p = getInjected();
  if (!p) return { error: "no-wallet" };
  try {
    const accounts = (await p.request({ method: "eth_requestAccounts" })) as string[];
    const address = accounts?.[0];
    if (!address) return { error: "no account returned" };
    await ensureXLayer(p);
    return { address };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "connection rejected" };
  }
}

// A fixed message so the signature — and thus the derived key — is deterministic:
// the same wallet always reproduces the same agent wallet, on any device.
const AGENT_DERIVATION_MESSAGE =
  "Themis — derive my agent wallet (v1).\n\n" +
  "Signing this creates a trading-agent wallet that follows you across devices. " +
  "It is a signature, NOT a transaction — no gas, no funds move. " +
  "Only sign this on themis / trythemis.vercel.app.";

/** Connect the user's wallet and deterministically derive + install the agent wallet
 *  from a signature, mapping it to the user address. Consistent across devices. */
export async function connectAndDeriveAgent(): Promise<
  { userAddress: string; agentAddress: string } | { error: string }
> {
  const p = getInjected();
  if (!p) return { error: "no-wallet" };
  try {
    const accounts = (await p.request({ method: "eth_requestAccounts" })) as string[];
    const userAddress = accounts?.[0];
    if (!userAddress) return { error: "no account returned" };
    await ensureXLayer(p);
    const signature = (await p.request({
      method: "personal_sign",
      params: [AGENT_DERIVATION_MESSAGE, userAddress],
    })) as string;
    if (!signature || signature.length < 132) return { error: "signature rejected" };
    const agentPk = keccak256(signature as Hex); // 32-byte deterministic key
    const agentAddress = setAgentKey(agentPk, userAddress);
    return { userAddress, agentAddress };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "connection rejected" };
  }
}
