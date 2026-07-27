// Plain-math indicators computed from candles — no dependencies
import type { Candle } from "@/lib/market/okx";
import type { BookEvidence, MarketSnapshot, Side } from "@/lib/types";
import { getCandles, getTicker, getOrderBook, bookMetrics, fillFromBook } from "@/lib/market/okx";

export function ema(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  let e = values[0];
  for (let i = 1; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}

export function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function atr(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = candles[i - 1].close;
    trs.push(
      Math.max(
        c.high - c.low,
        Math.abs(c.high - prevClose),
        Math.abs(c.low - prevClose)
      )
    );
  }
  return ema(trs, period);
}

/** Read the live book into tribunal evidence for an intent of `sizeUsd` on `side`. */
async function readBook(symbol: string, side: Side, sizeUsd: number): Promise<BookEvidence | null> {
  try {
    const book = await getOrderBook(symbol, 50);
    const m = bookMetrics(book);
    if (!m) return null;
    const fill = fillFromBook(book, side, Math.max(sizeUsd, 50));
    const slippagePct = fill?.slippagePct ?? 0;
    return {
      spreadPct: m.spreadPct,
      bidDepthUsd: m.bidDepthUsd,
      askDepthUsd: m.askDepthUsd,
      imbalance: m.imbalance,
      topWall: m.topWall,
      slippagePct,
      thin: (fill?.exhausted ?? false) || slippagePct > 0.8,
    };
  } catch {
    return null; // book feed hiccup — the tribunal falls back to price evidence
  }
}

export async function buildSnapshot(
  symbol: string,
  side: Side = "long",
  sizeUsd = 100
): Promise<MarketSnapshot> {
  const [ticker, candles, book] = await Promise.all([
    getTicker(symbol),
    getCandles(symbol, "60", 120),
    readBook(symbol, side, sizeUsd),
  ]);
  const closes = candles.map((c) => c.close);
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const a = atr(candles, 14);
  const spread = (e20 - e50) / ticker.price;
  return {
    symbol: symbol.toUpperCase(),
    price: ticker.price,
    chg24hPct: ticker.chg24hPct,
    volume24h: ticker.volume24h,
    rsi14: rsi(closes, 14),
    ema20: e20,
    ema50: e50,
    atr14: a,
    atrPct: (a / ticker.price) * 100,
    trend: spread > 0.001 ? "up" : spread < -0.001 ? "down" : "flat",
    book,
    ts: Date.now(),
  };
}
