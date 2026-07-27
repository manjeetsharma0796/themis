"use client";
// The candlestick evidence — live OKX candles for the symbol before the court.
// Headerless: MarketPanel owns the token/interval controls above it.
// Colors are the validated polarity pair (#2E9E74 up / #E5484D down);
// grid and axes stay recessive per the chart doctrine.
import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/lib/market/okx";

export function CandleChart({ symbol, interval = "60" }: { symbol: string; interval?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

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
  }, [symbol, interval]);

  return <div ref={containerRef} className="h-full min-h-0 w-full" />;
}
