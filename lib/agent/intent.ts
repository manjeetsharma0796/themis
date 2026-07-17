// Natural-language intent → structured trade intent.
// Deterministic rule parser; llm.ts can refine when a key is configured.
import type { Intent } from "@/lib/types";
import { SYMBOLS } from "@/lib/types";

const SYMBOL_ALIASES: Record<string, string> = {
  btc: "BTC", bitcoin: "BTC", xbt: "BTC",
  eth: "ETH", ethereum: "ETH", ether: "ETH",
  sol: "SOL", solana: "SOL",
  sui: "SUI",
  mnt: "MNT", mantle: "MNT",
};

const LONG_WORDS = ["long", "buy", "bull", "bullish", "enter", "accumulate", "ape"];
const SHORT_WORDS = ["short", "sell", "bear", "bearish", "fade", "dump"];

export function parseIntent(text: string): Intent {
  const raw = text.trim();
  const lower = raw.toLowerCase();

  // symbol
  let symbol = "";
  for (const [alias, sym] of Object.entries(SYMBOL_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(lower)) {
      symbol = sym;
      break;
    }
  }

  // side
  let side: Intent["side"] | null = null;
  if (LONG_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(lower))) side = "long";
  else if (SHORT_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(lower))) side = "short";

  // size: "$200", "200 usd", "with 200", "200"
  let sizeUsd = 0;
  const m =
    lower.match(/\$\s*([\d,]+(?:\.\d+)?)/) ||
    lower.match(/([\d,]+(?:\.\d+)?)\s*(?:usd|usdt|dollars|bucks)/) ||
    lower.match(/(?:with|for|size)\s+\$?([\d,]+(?:\.\d+)?)/) ||
    lower.match(/\b([\d,]{2,})\b/);
  if (m) sizeUsd = parseFloat(m[1].replace(/,/g, ""));

  const isTrade = symbol !== "" && side !== null;
  return {
    action: isTrade ? "trade" : "question",
    symbol: symbol || "BTC",
    side: side ?? "long",
    sizeUsd: sizeUsd > 0 ? Math.min(sizeUsd, 5000) : 100,
    raw,
  };
}

export function describeIntent(i: Intent): string {
  return `${i.side.toUpperCase()} ${i.symbol} · $${i.sizeUsd}`;
}

export const SUPPORTED = Object.keys(SYMBOLS);
