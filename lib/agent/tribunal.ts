// The Tribunal — Advocate argues the user's intent, Skeptic prosecutes it,
// the Judge weighs live evidence and rules. All arguments are grounded in the
// real market snapshot (OKX candles + live order book), so every line cites
// actual data — including the resting liquidity the trade would actually hit.
import type {
  Intent,
  MarketSnapshot,
  TribunalLine,
  Verdict,
} from "@/lib/types";

const fmt = (n: number, d = 2) =>
  n.toLocaleString("en-US", { maximumFractionDigits: d });

export function advocate(intent: Intent, s: MarketSnapshot): TribunalLine {
  const bullish = intent.side === "long";
  const points: string[] = [];

  if (bullish ? s.trend === "up" : s.trend === "down")
    points.push(
      `the hourly trend is ${s.trend} — EMA20 ${fmt(s.ema20)} ${bullish ? "above" : "below"} EMA50 ${fmt(s.ema50)}, momentum favors this entry`
    );
  if (bullish ? s.chg24hPct > 0 : s.chg24hPct < 0)
    points.push(`24h tape confirms: ${fmt(s.chg24hPct)}% in our direction`);
  if (bullish ? s.rsi14 < 45 : s.rsi14 > 55)
    points.push(
      `RSI at ${fmt(s.rsi14, 0)} leaves room before ${bullish ? "overbought" : "oversold"} territory`
    );
  if (s.atrPct < 1.2)
    points.push(`volatility is contained (ATR ${fmt(s.atrPct)}% of price) — entry risk is modest`);
  if (s.book) {
    const b = s.book;
    if (b.slippagePct < 0.15 && !b.thin)
      points.push(`the book is deep — $${intent.sizeUsd} fills with only ${fmt(b.slippagePct)}% slippage`);
    if ((bullish ? b.imbalance : -b.imbalance) > 0.18)
      points.push(
        `resting liquidity leans our way — ${fmt(Math.abs(b.imbalance) * 100, 0)}% ${b.imbalance > 0 ? "bid" : "ask"}-heavy within 1%`
      );
    if (b.topWall && ((bullish && b.topWall.side === "bid") || (!bullish && b.topWall.side === "ask")))
      points.push(`a $${fmt(b.topWall.usd / 1000, 0)}K ${b.topWall.side} wall at ${fmt(b.topWall.price)} braces the level`);
  }
  if (points.length === 0)
    points.push(
      `conviction trade: price ${fmt(s.price)} with ATR ${fmt(s.atrPct)}% — the client accepts the risk and the sizing is small`
    );

  return {
    role: "advocate",
    text: `Your Honor, my client moves to ${intent.side.toUpperCase()} ${intent.symbol} for $${intent.sizeUsd}. The evidence: ${points.join("; ")}.`,
  };
}

export function skeptic(intent: Intent, s: MarketSnapshot): TribunalLine {
  const bullish = intent.side === "long";
  const points: string[] = [];

  if (bullish ? s.trend === "down" : s.trend === "up")
    points.push(
      `the trend is against them — EMA20 ${fmt(s.ema20)} vs EMA50 ${fmt(s.ema50)} points ${s.trend}`
    );
  if (bullish ? s.chg24hPct < 0 : s.chg24hPct > 0)
    points.push(`the 24h tape reads ${fmt(s.chg24hPct)}% — fighting the market`);
  if (bullish ? s.rsi14 > 65 : s.rsi14 < 35)
    points.push(`RSI ${fmt(s.rsi14, 0)} is stretched — this entry chases`);
  if (s.atrPct > 1.8)
    points.push(`ATR is ${fmt(s.atrPct)}% of price — volatility can stop this out instantly`);
  if (s.book) {
    const b = s.book;
    if (b.thin || b.slippagePct > 0.4)
      points.push(`the book is thin — $${intent.sizeUsd} slips ${fmt(b.slippagePct)}% just to get filled`);
    if ((bullish ? -b.imbalance : b.imbalance) > 0.18)
      points.push(
        `resting liquidity leans against us — ${fmt(Math.abs(b.imbalance) * 100, 0)}% ${b.imbalance > 0 ? "bid" : "ask"}-heavy`
      );
    if (b.topWall && ((bullish && b.topWall.side === "ask") || (!bullish && b.topWall.side === "bid")))
      points.push(`a $${fmt(b.topWall.usd / 1000, 0)}K ${b.topWall.side} wall at ${fmt(b.topWall.price)} caps the move`);
    if (b.spreadPct > 0.08)
      points.push(`the spread is wide at ${fmt(b.spreadPct)}% — you pay the crossing cost on entry and exit`);
  }
  if (points.length === 0)
    points.push(
      `even a clean setup can fail: RSI ${fmt(s.rsi14, 0)} is mid-range and edge here is thin — the burden of proof is not met`
    );

  return {
    role: "skeptic",
    text: `Objection. ${points.join("; ")}. I move to reject or cut the size.`,
  };
}

export function judge(intent: Intent, s: MarketSnapshot): Verdict {
  const bullish = intent.side === "long";
  let score = 50;

  // Trend alignment ±20
  if (s.trend !== "flat") score += (bullish ? s.trend === "up" : s.trend === "down") ? 20 : -20;
  // 24h momentum ±12
  score += Math.max(-12, Math.min(12, (bullish ? 1 : -1) * s.chg24hPct * 3));
  // RSI positioning ±10 (reward entering before the crowd, punish chasing)
  if (bullish) score += s.rsi14 < 40 ? 10 : s.rsi14 > 70 ? -10 : 0;
  else score += s.rsi14 > 60 ? 10 : s.rsi14 < 30 ? -10 : 0;
  // Volatility tax up to −8
  score -= Math.max(0, Math.min(8, (s.atrPct - 1) * 5));
  // Order-book evidence: slippage tax up to −12, imbalance in our favor ±6
  if (s.book) {
    score -= Math.min(12, s.book.slippagePct * 10);
    score += Math.max(-6, Math.min(6, (bullish ? 1 : -1) * s.book.imbalance * 12));
  }

  const confidence = Math.round(Math.max(2, Math.min(98, score)));

  let ruling: Verdict["ruling"];
  let sizeUsd = intent.sizeUsd;
  if (confidence >= 62) ruling = "APPROVE";
  else if (confidence >= 45) {
    ruling = "REVISE";
    sizeUsd = Math.max(10, Math.round(intent.sizeUsd / 2));
  } else ruling = "REJECT";

  // A thin book can't safely absorb full size — cut it even on an otherwise-clean read.
  if (ruling === "APPROVE" && s.book?.thin) {
    ruling = "REVISE";
    sizeUsd = Math.max(10, Math.round(intent.sizeUsd / 2));
  }

  const bookNote = s.book
    ? s.book.thin
      ? ` The book is thin (${fmt(s.book.slippagePct)}% slippage on size), so liquidity caps the size.`
      : ` The book absorbs it cleanly (${fmt(s.book.slippagePct)}% slippage).`
    : "";
  const rationale =
    (ruling === "APPROVE"
      ? `Trend, momentum and volatility jointly support the ${intent.side}. Entry admitted at full size.`
      : ruling === "REVISE"
        ? `The evidence is mixed — the court admits the entry at half size ($${sizeUsd}) to bound the risk.`
        : `The evidence contradicts the motion. Entry denied; capital preserved.`) + bookNote;

  return { ruling, confidence, sizeUsd, rationale };
}

export function judgeLine(v: Verdict): TribunalLine {
  return {
    role: "judge",
    text: `Verdict: ${v.ruling} — confidence ${v.confidence}/100. ${v.rationale}`,
  };
}
