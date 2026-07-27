// OKX v5 public market API — no API key required for market data.
// Docs: GET /api/v5/market/{candles,ticker,books}. instId like "BTC-USDT".
import type { Side } from "@/lib/types";

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
  "5": "5m",
  "15": "15m",
  "60": "1H",
  "240": "4H",
  "1D": "1D",
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
  interval: string = "60",
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

// ── order book ───────────────────────────────────────────────
export type OrderBookLevel = { price: number; size: number }; // size in base coin
export type OrderBook = { bids: OrderBookLevel[]; asks: OrderBookLevel[]; ts: number };

/** Live order book. OKX returns asks ascending, bids descending by price. */
export async function getOrderBook(symbol: string, depth = 20): Promise<OrderBook> {
  const res = await fetch(
    `${BASE}/api/v5/market/books?instId=${instId(symbol)}&sz=${depth}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`OKX books ${res.status}`);
  const json = await res.json();
  const d = json?.data?.[0];
  if (!d) throw new Error("OKX books: empty result");
  const map = (rows: string[][]): OrderBookLevel[] =>
    (rows ?? []).map((r) => ({ price: parseFloat(r[0]), size: parseFloat(r[1]) }));
  return { bids: map(d.bids), asks: map(d.asks), ts: parseInt(d.ts, 10) || Date.now() };
}

export type BookMetrics = {
  midPrice: number;
  spreadPct: number;
  bidDepthUsd: number; // within 1% of mid
  askDepthUsd: number;
  imbalance: number; // (bid−ask)/(bid+ask) within 1%, −1..1
  topWall: { price: number; usd: number; side: "bid" | "ask" } | null;
};

/** Summarize the book into the numbers the tribunal argues over. */
export function bookMetrics(book: OrderBook): BookMetrics | null {
  const bestBid = book.bids[0]?.price;
  const bestAsk = book.asks[0]?.price;
  if (!bestBid || !bestAsk) return null;
  const mid = (bestBid + bestAsk) / 2;
  const band = mid * 0.01; // ±1%
  let bidUsd = 0;
  let askUsd = 0;
  let topWall: BookMetrics["topWall"] = null;
  for (const b of book.bids) {
    if (b.price < mid - band) break;
    const usd = b.price * b.size;
    bidUsd += usd;
    if (!topWall || usd > topWall.usd) topWall = { price: b.price, usd, side: "bid" };
  }
  for (const a of book.asks) {
    if (a.price > mid + band) break;
    const usd = a.price * a.size;
    askUsd += usd;
    if (!topWall || usd > topWall.usd) topWall = { price: a.price, usd, side: "ask" };
  }
  const tot = bidUsd + askUsd;
  return {
    midPrice: mid,
    spreadPct: ((bestAsk - bestBid) / mid) * 100,
    bidDepthUsd: bidUsd,
    askDepthUsd: askUsd,
    imbalance: tot > 0 ? (bidUsd - askUsd) / tot : 0,
    topWall,
  };
}

export type FillQuote = {
  avgPrice: number; // depth-weighted fill price
  slippagePct: number; // positive cost vs best price
  filledUsd: number;
  exhausted: boolean; // book ran out before the size filled
};

/** Walk the book for `sizeUsd`: a long buys up the asks, a short sells down the bids. */
export function fillFromBook(book: OrderBook, side: Side, sizeUsd: number): FillQuote | null {
  const levels = side === "long" ? book.asks : book.bids;
  const best = levels[0]?.price;
  if (!best) return null;
  let remaining = sizeUsd;
  let coin = 0;
  let spent = 0;
  for (const lvl of levels) {
    const lvlUsd = lvl.price * lvl.size;
    const take = Math.min(remaining, lvlUsd);
    coin += take / lvl.price;
    spent += take;
    remaining -= take;
    if (remaining <= 0) break;
  }
  const avgPrice = coin > 0 ? spent / coin : best;
  return {
    avgPrice,
    slippagePct: Math.abs((avgPrice - best) / best) * 100,
    filledUsd: spent,
    exhausted: remaining > 0.01,
  };
}

/** Fetch the book and quote a depth-weighted fill in one call (executor path). */
export async function getFillQuote(
  symbol: string,
  side: Side,
  sizeUsd: number
): Promise<FillQuote | null> {
  const book = await getOrderBook(symbol, 50);
  return fillFromBook(book, side, sizeUsd);
}
