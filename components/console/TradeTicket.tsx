"use client";
// Manual trade ticket under the order book — size + Buy/Sell for direct paper
// fills, no copilot needed. Every fill is still sealed and anchored on X Layer,
// so hand-placed trades share the same on-chain integrity record.
import { useState } from "react";
import type { Position, Signal } from "@/lib/types";

type Note = { text: string; explorer?: string; tone: "up" | "down" | "muted" };

export function TradeTicket({ symbol, onTraded }: { symbol: string; onTraded?: () => void }) {
  const [size, setSize] = useState("100");
  const [busy, setBusy] = useState<null | "long" | "short">(null);
  const [note, setNote] = useState<Note | null>(null);

  const trade = async (side: "long" | "short") => {
    const sizeUsd = Number(size);
    if (!sizeUsd || sizeUsd <= 0 || busy) return;
    setBusy(side);
    setNote(null);
    try {
      const r = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, side, sizeUsd }),
      });
      const j = (await r.json()) as { signal?: Signal; position?: Position; error?: string };
      if (!r.ok || !j.position) {
        setNote({ text: j.error ?? "Trade failed.", tone: "down" });
        return;
      }
      const p = j.position;
      const px = p.entryPrice.toLocaleString(undefined, {
        maximumFractionDigits: p.entryPrice >= 1000 ? 1 : 4,
      });
      setNote({
        text: `Filled ${side} ${symbol} $${sizeUsd} @ ${px}${p.slippagePct != null ? ` · slip ${p.slippagePct.toFixed(2)}%` : ""}`,
        tone: side === "long" ? "up" : "down",
      });
      onTraded?.();

      // Anchor the seal on X Layer with the agent wallet (unless the server already did).
      const sig = j.signal;
      if (sig && !sig.anchorTx) {
        try {
          const { anchorSealOnChain } = await import("@/lib/wallet/anchorClient");
          const a = await anchorSealOnChain(sig.commitHash);
          if (a) {
            await fetch("/api/signals/anchor", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: sig.id, txHash: a.txHash, explorer: a.explorer }),
            });
            setNote((n) => (n ? { ...n, explorer: a.explorer } : n));
            onTraded?.();
          }
        } catch {
          /* agent wallet unfunded — the seal stays off-chain, still on the record */
        }
      } else if (sig?.anchorExplorer) {
        setNote((n) => (n ? { ...n, explorer: sig.anchorExplorer } : n));
      }
    } catch {
      setNote({ text: "Network error — try again.", tone: "down" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="border-t border-hairline-soft p-2.5">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded bg-ink px-2 ring-1 ring-hairline-soft focus-within:ring-brass">
          <span className="font-mono text-[10px] text-faint">$</span>
          <input
            value={size}
            onChange={(e) => setSize(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal"
            aria-label="Order size in USD"
            className="w-12 bg-transparent py-1.5 font-mono text-xs text-parchment outline-none"
          />
        </div>
        <button
          onClick={() => trade("long")}
          disabled={!!busy}
          className="flex-1 rounded bg-up py-1.5 font-mono text-xs font-semibold text-ink transition-transform hover:-translate-y-px disabled:opacity-50"
        >
          {busy === "long" ? "filling…" : `Buy ${symbol}`}
        </button>
        <button
          onClick={() => trade("short")}
          disabled={!!busy}
          className="flex-1 rounded bg-down py-1.5 font-mono text-xs font-semibold text-ink transition-transform hover:-translate-y-px disabled:opacity-50"
        >
          {busy === "short" ? "filling…" : `Sell ${symbol}`}
        </button>
      </div>
      {note && (
        <div
          className={`mt-1.5 flex items-center justify-between gap-2 font-mono text-[10px] ${
            note.tone === "up" ? "text-up" : note.tone === "down" ? "text-down" : "text-muted"
          }`}
        >
          <span className="truncate">{note.text}</span>
          {note.explorer && (
            <a
              href={note.explorer}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-brass hover:underline"
            >
              ⛓ tx ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}
