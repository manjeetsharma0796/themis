// Deterministic market fixtures for tests. Never touches the network.
import type { Candle, OrderBook } from "@/lib/market/okx";

/** Linear congruential PRNG — same seed, same sequence, every run. */
export function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function makeCandles(count = 120, seed = 20260803, start = 60000): Candle[] {
  const rnd = lcg(seed);
  const out: Candle[] = [];
  let px = start;
  let t = 1_750_000_000;
  for (let i = 0; i < count; i++) {
    const open = px;
    const close = open * (1 + (rnd() - 0.48) * 0.02);
    const wick = open * rnd() * 0.008;
    out.push({
      time: t,
      open,
      high: Math.max(open, close) + wick,
      low: Math.min(open, close) - wick,
      close,
      volume: 10 + rnd() * 90,
    });
    px = close;
    t += 3600;
  }
  return out;
}

export function makeBook(mid = 60000, seed = 7): OrderBook {
  const rnd = lcg(seed);
  const bids = [];
  const asks = [];
  for (let i = 0; i < 50; i++) {
    bids.push({ price: mid * (1 - 0.0002 * (i + 1)), size: 0.1 + rnd() * 2 });
    asks.push({ price: mid * (1 + 0.0002 * (i + 1)), size: 0.1 + rnd() * 2 });
  }
  return { bids, asks, ts: 1_750_000_000_000 };
}
