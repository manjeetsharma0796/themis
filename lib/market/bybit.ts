// Bybit v5 public REST — no API key required
import { SYMBOLS } from "@/lib/types";

const BASE = "https://api.bybit.com";

export type Candle = {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function pair(symbol: string): string {
  const p = SYMBOLS[symbol.toUpperCase()];
  if (!p) throw new Error(`Unsupported symbol: ${symbol}`);
  return p;
}

export async function getTicker(symbol: string): Promise<{
  price: number;
  chg24hPct: number;
  volume24h: number;
}> {
  const res = await fetch(
    `${BASE}/v5/market/tickers?category=linear&symbol=${pair(symbol)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Bybit ticker ${res.status}`);
  const json = await res.json();
  const t = json?.result?.list?.[0];
  if (!t) throw new Error("Bybit ticker: empty result");
  return {
    price: parseFloat(t.lastPrice),
    chg24hPct: parseFloat(t.price24hPcnt) * 100,
    volume24h: parseFloat(t.turnover24h),
  };
}

export async function getCandles(
  symbol: string,
  interval: "15" | "60" | "240" = "60",
  limit = 100
): Promise<Candle[]> {
  const res = await fetch(
    `${BASE}/v5/market/kline?category=linear&symbol=${pair(symbol)}&interval=${interval}&limit=${limit}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Bybit kline ${res.status}`);
  const json = await res.json();
  const rows: string[][] = json?.result?.list ?? [];
  // Bybit returns newest-first; normalize oldest-first
  return rows
    .map((r) => ({
      time: Math.floor(parseInt(r[0], 10) / 1000),
      open: parseFloat(r[1]),
      high: parseFloat(r[2]),
      low: parseFloat(r[3]),
      close: parseFloat(r[4]),
      volume: parseFloat(r[5]),
    }))
    .reverse();
}
