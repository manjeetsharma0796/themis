// x402 configuration — all OKX-specific values arrive via env at ASP-listing time.
// Until a facilitator + payTo + asset are set, the endpoint runs in labelled demo mode.
import { XLAYER_MAINNET_CAIP2 } from "@/lib/chain/xlayer";

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

// OKX.AI's ASP marketplace settles x402 on X Layer MAINNET, so the challenge
// network MUST be eip155:196 — testnet (1952) is rejected at listing review.
// Ignore any stale env that would downgrade it; only an explicit 196 is honored.
function validNetwork(env?: string): string {
  return env === "eip155:196" ? env : XLAYER_MAINNET_CAIP2;
}

// USDT0 on X Layer mainnet (eip155:196) — the token OKX's x402 facilitator
// requires for ASP settlement (per listing review). NOT the bridged "Tether USD".
// Lowercased so it's always a valid address regardless of EIP-55 checksum.
const XLAYER_USDT0 = "0x779ded0c9e1022225f8e0630b35a9b54be713736";

export function x402Config(): X402Config {
  const asset = process.env.X402_ASSET || XLAYER_USDT0;
  const payTo = process.env.X402_PAY_TO ?? "";
  const facilitatorUrl = process.env.X402_FACILITATOR_URL ?? null;
  return {
    network: validNetwork(process.env.X402_NETWORK),
    asset,
    payTo,
    assetName: process.env.X402_ASSET_NAME ?? "USD₮0", // exact on-chain EIP-712 name (₮ = U+20AE)
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
