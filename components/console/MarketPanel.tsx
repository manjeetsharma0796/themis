"use client";
// The market terminal — the console's middle column. Token selector + interval
// controls on top, live candles, and the order book below. Defaults to the
// symbol under judgment (follows the copilot), but the user can drive it directly.
import { useEffect, useState } from "react";
import { CandleChart } from "./CandleChart";
import { OrderBook } from "./OrderBook";

const TOKENS = ["BTC", "ETH", "SOL", "SUI", "MNT"];
const INTERVALS = [
  { code: "5", label: "5m" },
  { code: "15", label: "15m" },
  { code: "60", label: "1H" },
  { code: "240", label: "4H" },
  { code: "1D", label: "1D" },
];

const fmtPrice = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: n >= 1000 ? 1 : n >= 1 ? 2 : 4 });

export function MarketPanel({ symbol }: { symbol: string }) {
  const [view, setView] = useState(symbol);
  const [bar, setBar] = useState("60");
  const [tick, setTick] = useState<{ price: number; chg: number } | null>(null);

  // Follow the case under judgment when the copilot changes symbol; user can override.
  useEffect(() => setView(symbol), [symbol]);

  useEffect(() => {
    setTick(null);
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/market/ticker?symbol=${view}`);
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled && typeof j.price === "number") setTick({ price: j.price, chg: j.chg24hPct });
      } catch {
        /* ignore feed hiccup */
      }
    };
    void load();
    const iv = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [view]);

  return (
    <section className="keyline-soft flex h-full min-h-0 flex-col rounded bg-surface">
      <header className="border-b border-hairline-soft px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <select
                value={view}
                onChange={(e) => setView(e.target.value)}
                aria-label="Select market"
                className="cursor-pointer appearance-none rounded bg-ink py-1 pl-2.5 pr-7 font-mono text-sm font-semibold text-parchment outline-none ring-1 ring-hairline-soft focus:ring-brass"
              >
                {TOKENS.map((t) => (
                  <option key={t} value={t}>
                    {t}/USDT
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[8px] text-faint">
                ▼
              </span>
            </div>
            {tick && (
              <div className="flex items-baseline gap-1.5">
                <span className={`font-mono text-sm tabular-nums ${tick.chg >= 0 ? "text-up" : "text-down"}`}>
                  {fmtPrice(tick.price)}
                </span>
                <span className={`font-mono text-[10px] ${tick.chg >= 0 ? "text-up" : "text-down"}`}>
                  {tick.chg >= 0 ? "+" : ""}
                  {tick.chg.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
          <span className="hidden font-mono text-[9px] uppercase tracking-widest text-faint sm:block">
            okx live · evidence
          </span>
        </div>
        <div className="mt-2 flex gap-1">
          {INTERVALS.map((iv) => (
            <button
              key={iv.code}
              onClick={() => setBar(iv.code)}
              className={`rounded px-2 py-0.5 font-mono text-[10px] transition-colors ${
                bar === iv.code ? "bg-brass text-ink" : "text-muted hover:text-parchment"
              }`}
            >
              {iv.label}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-[3] border-b border-hairline-soft">
        <CandleChart symbol={view} interval={bar} />
      </div>

      <div className="min-h-0 flex-[2]">
        <OrderBook symbol={view} />
      </div>
    </section>
  );
}
