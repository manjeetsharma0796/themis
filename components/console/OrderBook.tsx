"use client";
// Live order book — the exhibit the tribunal reads. Bids/asks with depth bars,
// the spread at the fold, and an imbalance strip. Polls the OKX proxy ~1s.
// This isn't decoration: the same book drives fill slippage and the judge's read.
import { useEffect, useRef, useState } from "react";

type Level = { price: number; size: number };
type Metrics = {
  midPrice: number;
  spreadPct: number;
  bidDepthUsd: number;
  askDepthUsd: number;
  imbalance: number;
  topWall: { price: number; usd: number; side: "bid" | "ask" } | null;
} | null;
type BookResp = { book: { bids: Level[]; asks: Level[]; ts: number }; metrics: Metrics };

const ROWS = 11;

function fmtPrice(n: number): string {
  const d = n >= 1000 ? 1 : n >= 1 ? 2 : n >= 0.01 ? 4 : 6;
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtAmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(2)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 3 });
}
function fmtUsd(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(2)}K`;
  return n.toFixed(0);
}

function Row({ level, max, side }: { level: Level; max: number; side: "bid" | "ask" }) {
  const total = level.price * level.size;
  const pct = max > 0 ? Math.min(100, (total / max) * 100) : 0;
  const color = side === "ask" ? "text-down" : "text-up";
  const bar = side === "ask" ? "rgba(229,72,77,0.16)" : "rgba(46,158,116,0.16)";
  return (
    <div className="relative grid grid-cols-3 px-3 py-[3px] font-mono text-[11px] tabular-nums">
      <div className="absolute inset-y-0 right-0" style={{ width: `${pct}%`, background: bar }} />
      <span className={`relative ${color}`}>{fmtPrice(level.price)}</span>
      <span className="relative text-right text-parchment/85">{fmtAmt(level.size)}</span>
      <span className="relative text-right text-faint">{fmtUsd(total)}</span>
    </div>
  );
}

export function OrderBook({ symbol }: { symbol: string }) {
  const [data, setData] = useState<BookResp | null>(null);
  const [err, setErr] = useState(false);
  const prevMid = useRef<number | null>(null);
  const [midDir, setMidDir] = useState<"up" | "down" | "flat">("flat");
  const scrollRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const centeredFor = useRef<string | null>(null);

  useEffect(() => {
    setData(null);
    setErr(false);
    centeredFor.current = null;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/market/book?symbol=${symbol}&depth=${ROWS}`);
        if (!res.ok) throw new Error();
        const j = (await res.json()) as BookResp;
        if (cancelled || !j.book) return;
        const mid = j.metrics?.midPrice ?? null;
        if (mid != null && prevMid.current != null)
          setMidDir(mid > prevMid.current ? "up" : mid < prevMid.current ? "down" : "flat");
        prevMid.current = mid;
        setData(j);
        setErr(false);
      } catch {
        if (!cancelled) setErr(true);
      }
    };
    void load();
    const iv = setInterval(load, 1000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [symbol]);

  // Center the spread once per symbol so both sides show at any panel height.
  // Deferred to the next frame so the flex layout has settled before we measure.
  useEffect(() => {
    if (!data || centeredFor.current === symbol) return;
    const id = requestAnimationFrame(() => {
      const c = scrollRef.current;
      const m = midRef.current;
      if (!c || !m || c.scrollHeight <= c.clientHeight) return;
      c.scrollTop = m.offsetTop + m.clientHeight / 2 - c.clientHeight / 2;
      centeredFor.current = symbol;
    });
    return () => cancelAnimationFrame(id);
  }, [data, symbol]);

  const book = data?.book;
  const m = data?.metrics;
  // asks shown high→low so the best ask sits just above the fold
  const asks = book ? book.asks.slice(0, ROWS).reverse() : [];
  const bids = book ? book.bids.slice(0, ROWS) : [];
  const maxTotal = book
    ? Math.max(
        ...[...book.asks.slice(0, ROWS), ...book.bids.slice(0, ROWS)].map((l) => l.price * l.size),
        1
      )
    : 1;
  const bidShare =
    m && m.bidDepthUsd + m.askDepthUsd > 0
      ? (m.bidDepthUsd / (m.bidDepthUsd + m.askDepthUsd)) * 100
      : 50;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* column headers */}
      <div className="grid grid-cols-3 border-b border-hairline-soft px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-faint">
        <span>Price · USDT</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Total</span>
      </div>

      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
        {!book && !err && (
          <div className="flex h-full items-center justify-center font-mono text-[10px] text-faint">
            loading book…
          </div>
        )}
        {err && !book && (
          <div className="flex h-full items-center justify-center font-mono text-[10px] text-down">
            book feed unavailable
          </div>
        )}
        {book && (
          <>
            <div>
              {asks.map((l, i) => (
                <Row key={`a${i}`} level={l} max={maxTotal} side="ask" />
              ))}
            </div>

            {/* the fold — mid price + spread */}
            <div
              ref={midRef}
              className="flex items-baseline justify-between border-y border-hairline-soft bg-ink/40 px-3 py-1.5"
            >
              <span
                className={`font-mono text-lg font-semibold tabular-nums ${
                  midDir === "up" ? "text-up" : midDir === "down" ? "text-down" : "text-parchment"
                }`}
              >
                {m ? fmtPrice(m.midPrice) : "—"}
                {midDir === "up" ? " ↑" : midDir === "down" ? " ↓" : ""}
              </span>
              <span className="font-mono text-[10px] text-faint">
                spread {m ? m.spreadPct.toFixed(3) : "—"}%
              </span>
            </div>

            <div>
              {bids.map((l, i) => (
                <Row key={`b${i}`} level={l} max={maxTotal} side="bid" />
              ))}
            </div>
          </>
        )}
      </div>

      {/* imbalance strip — the depth read the skeptic cites */}
      {m && (
        <div className="border-t border-hairline-soft px-3 py-1.5">
          <div className="flex h-1 overflow-hidden rounded-full">
            <div className="bg-up/70" style={{ width: `${bidShare}%` }} />
            <div className="bg-down/70" style={{ width: `${100 - bidShare}%` }} />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[9px] text-faint">
            <span className="text-up">{bidShare.toFixed(0)}% bids</span>
            <span>±1% depth</span>
            <span className="text-down">{(100 - bidShare).toFixed(0)}% asks</span>
          </div>
        </div>
      )}
    </div>
  );
}
