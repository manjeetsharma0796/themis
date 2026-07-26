// OKX v5 public market API — no API key required for market data.
// Docs: GET /api/v5/market/{candles,ticker}. instId like "BTC-USDT".
const BASE = "https://www.okx.com";

/** Supported symbols → OKX spot instrument IDs. */
const INST: Record<string, string> = {
  BTC: "BTC-USDT",
  ETH: "ETH-USDT",
  SOL: "SOL-USDT",
  SUI: "SUI-USDT",
  MNT: "MNT-USDT",
};

/** UI interval codes → OKX bar codes. */
const BAR: Record<string, string> = {
  "15": "15m",
  "60": "1H",
  "240": "4H",
};

export const SUPPORTED = Object.keys(INST);

export type Candle = {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function instId(symbol: string): string {
  const id = INST[symbol.toUpperCase()];
  if (!id) throw new Error(`Unsupported symbol: ${symbol}`);
  return id;
}

export async function getTicker(symbol: string): Promise<{
  price: number;
  chg24hPct: number;
  volume24h: number;
}> {
  const res = await fetch(
    `${BASE}/api/v5/market/ticker?instId=${instId(symbol)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`OKX ticker ${res.status}`);
  const json = await res.json();
  const t = json?.data?.[0];
  if (!t) throw new Error("OKX ticker: empty result");
  const last = parseFloat(t.last);
  const open24h = parseFloat(t.open24h);
  return {
    price: last,
    chg24hPct: open24h ? ((last - open24h) / open24h) * 100 : 0,
    volume24h: parseFloat(t.volCcy24h),
  };
}

export async function getCandles(
  symbol: string,
  interval: "15" | "60" | "240" = "60",
  limit = 100
): Promise<Candle[]> {
  const bar = BAR[interval] ?? "1H";
  const res = await fetch(
    `${BASE}/api/v5/market/candles?instId=${instId(symbol)}&bar=${bar}&limit=${limit}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`OKX candles ${res.status}`);
  const json = await res.json();
  const rows: string[][] = json?.data ?? [];
  // OKX returns newest-first: [ts, o, h, l, c, vol, ...]. Normalize oldest-first.
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
