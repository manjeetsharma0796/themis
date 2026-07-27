// x402 configuration — all OKX-specific values arrive via env at ASP-listing time.
// Until a facilitator + payTo + asset are set, the endpoint runs in labelled demo mode.
import { XLAYER_CAIP2 } from "@/lib/chain/xlayer";

export type X402Config = {
  network: string; // CAIP-2
  asset: string; // stablecoin contract on X Layer
  payTo: string; // ASP Agentic Wallet address (assigned at listing)
  assetName: string;
  assetVersion: string;
  decimals: number;
  priceUsd: number;
  facilitatorUrl: string | null; // OKX facilitator base URL
  live: boolean; // true only when a real facilitator + payTo + asset are all present
};

// Only trust the env override if it's a real X Layer CAIP-2 (testnet 1952 / mainnet
// 196). A stale "eip155:195" (a deprecated id) falls back to the correct chain.
function validNetwork(env?: string): string {
  return env && /^eip155:(1952|196)$/.test(env) ? env : XLAYER_CAIP2;
}

export function x402Config(): X402Config {
  const asset = process.env.X402_ASSET ?? "";
  const payTo = process.env.X402_PAY_TO ?? "";
  const facilitatorUrl = process.env.X402_FACILITATOR_URL ?? null;
  return {
    network: validNetwork(process.env.X402_NETWORK),
    asset,
    payTo,
    assetName: process.env.X402_ASSET_NAME ?? "USDT",
    assetVersion: process.env.X402_ASSET_VERSION ?? "1",
    decimals: Number(process.env.X402_ASSET_DECIMALS ?? 6),
    priceUsd: Number(process.env.X402_PRICE_USD ?? 0.1),
    facilitatorUrl,
    live: Boolean(facilitatorUrl && payTo && asset),
  };
}

/** Price in atomic units of the stablecoin (e.g. $0.10 @ 6 decimals → "100000"). */
export function atomicAmount(cfg: X402Config): string {
  return BigInt(Math.round(cfg.priceUsd * 10 ** cfg.decimals)).toString();
}
