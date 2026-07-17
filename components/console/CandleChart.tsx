"use client";
// The evidence — live hourly candles for the symbol before the court.
// Colors are the validated polarity pair (#2E9E74 up / #E5484D down);
// grid and axes stay recessive per the chart doctrine.
import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/lib/market/bybit";

export function CandleChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [last, setLast] = useState<{ price: number; up: boolean } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: "#8f8b7d",
        fontFamily: "var(--font-geist-mono), monospace",
        fontSize: 10,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(232,227,216,0.04)" },
        horzLines: { color: "rgba(232,227,216,0.04)" },
      },
      rightPriceScale: { borderColor: "rgba(232,227,216,0.07)" },
      timeScale: { borderColor: "rgba(232,227,216,0.07)", timeVisible: true },
      crosshair: {
        vertLine: { color: "rgba(217,164,65,0.35)", labelBackgroundColor: "#8a6e3b" },
        horzLine: { color: "rgba(217,164,65,0.35)", labelBackgroundColor: "#8a6e3b" },
      },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#2e9e74",
      downColor: "#e5484d",
      borderVisible: false,
      wickUpColor: "#2e9e74",
      wickDownColor: "#e5484d",
    });
    chartRef.current = chart;

    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/market/candles?symbol=${symbol}&interval=60`);
        if (!res.ok) return;
        const candles = (await res.json()) as Candle[];
        if (cancelled || candles.length === 0) return;
        series.setData(
          candles.map((c) => ({
            time: c.time as UTCTimestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        );
        const tail = candles[candles.length - 1];
        setLast({ price: tail.close, up: tail.close >= tail.open });
        chart.timeScale().fitContent();
      } catch {
        /* feed hiccup — keep the last picture */
      }
    };
    void load();
    const iv = setInterval(load, 15_000);

    return () => {
      cancelled = true;
      clearInterval(iv);
      chart.remove();
      chartRef.current = null;
    };
  }, [symbol]);

  return (
    <section className="keyline-soft flex min-h-0 flex-col rounded bg-surface">
      <header className="flex items-baseline justify-between border-b border-hairline-soft px-4 py-3">
        <div>
          <h2 className="font-serif text-lg">The evidence</h2>
          <p className="font-mono text-[10px] uppercase tracking-widest text-faint">
            {symbol}/USDT · 1h · bybit live
          </p>
        </div>
        {last && (
          <span className={`font-mono text-sm ${last.up ? "text-up" : "text-down"}`}>
            {last.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
        )}
      </header>
      <div ref={containerRef} className="min-h-0 flex-1" />
    </section>
  );
}
