"use client";
// A compact candlestick chart rendered INLINE inside a chat message.
import { useEffect, useRef } from "react";
import { CandlestickSeries, createChart, type UTCTimestamp } from "lightweight-charts";
import type { Candle } from "@/lib/market/okx";

export function InlineChart({ symbol, interval }: { symbol: string; interval: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: "#928d80",
        fontFamily: "var(--font-geist-mono), monospace",
        fontSize: 9,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(232,227,216,0.04)" },
        horzLines: { color: "rgba(232,227,216,0.04)" },
      },
      rightPriceScale: { borderColor: "rgba(232,227,216,0.07)" },
      timeScale: { borderColor: "rgba(232,227,216,0.07)", timeVisible: true },
      crosshair: {
        vertLine: { color: "rgba(217,164,65,0.3)", labelBackgroundColor: "#8a6e3b" },
        horzLine: { color: "rgba(217,164,65,0.3)", labelBackgroundColor: "#8a6e3b" },
      },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#2e9e74",
      downColor: "#e5484d",
      borderVisible: false,
      wickUpColor: "#2e9e74",
      wickDownColor: "#e5484d",
    });
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/market/candles?symbol=${symbol}&interval=${interval}`);
        if (!res.ok) return;
        const candles = (await res.json()) as Candle[];
        if (cancelled || !Array.isArray(candles) || candles.length === 0) return;
        series.setData(
          candles.map((c) => ({
            time: c.time as UTCTimestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        );
        chart.timeScale().fitContent();
      } catch {
        /* feed hiccup */
      }
    })();
    return () => {
      cancelled = true;
      chart.remove();
    };
  }, [symbol, interval]);

  const label = interval === "15" ? "15m" : interval === "240" ? "4H" : "1H";
  return (
    <div className="keyline-soft overflow-hidden rounded bg-raised">
      <div className="flex items-baseline justify-between border-b border-hairline-soft px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
          {symbol}/USDT · {label}
        </span>
        <span className="font-mono text-[9px] text-faint">okx live</span>
      </div>
      <div ref={ref} className="h-[200px] w-full" />
    </div>
  );
}
