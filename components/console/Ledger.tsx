"use client";
// The ledger — equity, open positions marked to live prices, and the
// sealed-verdict record with one-tap hash verification.
import { useCallback, useEffect, useState } from "react";
import type { PortfolioView, Signal } from "@/lib/types";

const usd = (n: number) =>
  `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="keyline-soft rounded bg-raised px-3 py-2.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-faint">{label}</p>
      <p className={`mt-1 font-mono text-base ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

function VerifyChip({ id }: { id: string }) {
  const [state, setState] = useState<"idle" | "checking" | "ok" | "bad">("idle");
  const check = async () => {
    setState("checking");
    try {
      const res = await fetch(`/api/verify/${id}`);
      const json = (await res.json()) as { ok?: boolean };
      setState(json.ok ? "ok" : "bad");
    } catch {
      setState("bad");
    }
  };
  if (state === "ok")
    return <span className="font-mono text-[10px] text-up">⬡ seal verified</span>;
  if (state === "bad")
    return <span className="font-mono text-[10px] text-down">⬡ MISMATCH</span>;
  return (
    <button
      onClick={check}
      disabled={state === "checking"}
      className="font-mono text-[10px] text-brass-deep transition-colors hover:text-brass"
    >
      {state === "checking" ? "recomputing…" : "⬡ verify seal"}
    </button>
  );
}

export function Ledger({ version }: { version: number }) {
  const [portfolio, setPortfolio] = useState<PortfolioView | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        fetch("/api/portfolio").then((r) => r.json()),
        fetch("/api/signals").then((r) => r.json()),
      ]);
      if (!p.error) setPortfolio(p);
      if (Array.isArray(s)) setSignals(s);
    } catch {
      /* transient */
    }
  }, []);

  useEffect(() => {
    void load();
    const iv = setInterval(load, 12_000);
    return () => clearInterval(iv);
  }, [load, version]);

  const closePosition = async (id: string) => {
    await fetch("/api/positions/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    void load();
  };

  const pnlTone = (n: number) => (n > 0 ? "text-up" : n < 0 ? "text-down" : "text-muted");

  return (
    <section className="keyline-soft flex h-full min-h-0 flex-col rounded bg-surface">
      <header className="border-b border-hairline-soft px-4 py-3">
        <h2 className="font-serif text-lg">The ledger</h2>
        <p className="font-mono text-[10px] uppercase tracking-widest text-faint">
          paper fills · live marks · sealed record
        </p>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {portfolio && (
          <div className="grid grid-cols-3 gap-2">
            <Stat label="equity" value={usd(portfolio.equity)} />
            <Stat
              label="realized"
              value={usd(portfolio.realizedPnl)}
              tone={pnlTone(portfolio.realizedPnl)}
            />
            <Stat
              label="unrealized"
              value={usd(portfolio.unrealizedPnl)}
              tone={pnlTone(portfolio.unrealizedPnl)}
            />
          </div>
        )}

        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
            positions
          </p>
          {portfolio && portfolio.positions.length > 0 ? (
            <ul className="space-y-2">
              {portfolio.positions.slice(0, 12).map((p) => (
                <li key={p.id} className="keyline-soft rounded bg-raised px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-xs">
                      <span className={p.side === "long" ? "text-up" : "text-down"}>
                        {p.side === "long" ? "▲" : "▼"}
                      </span>{" "}
                      {p.symbol} <span className="text-faint">{usd(p.sizeUsd)}</span>
                    </span>
                    <span
                      className={`font-mono text-xs ${pnlTone(
                        p.status === "open" ? p.unrealizedPnl : (p.realizedPnl ?? 0)
                      )}`}
                    >
                      {usd(p.status === "open" ? p.unrealizedPnl : (p.realizedPnl ?? 0))}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-faint">
                      @{p.entryPrice.toLocaleString()} → {p.markPrice.toLocaleString()}
                    </span>
                    {p.status === "open" ? (
                      <button
                        onClick={() => closePosition(p.id)}
                        className="font-mono text-[10px] text-muted transition-colors hover:text-down"
                      >
                        close
                      </button>
                    ) : (
                      <span className="font-mono text-[10px] text-faint">settled</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-mono text-xs text-faint">no positions on the books</p>
          )}
        </div>

        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
            sealed verdicts
          </p>
          {signals.length > 0 ? (
            <ul className="space-y-2">
              {signals.slice(0, 10).map((s) => (
                <li key={s.id} className="keyline-soft rounded bg-raised px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-xs">
                      {s.verdict.ruling}{" "}
                      <span className="text-faint">
                        · {s.intent.side} {s.intent.symbol} · {s.verdict.confidence}/100
                      </span>
                    </span>
                    <span className="font-mono text-[10px] text-faint">
                      {new Date(s.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[10px] text-brass-deep">
                      {s.commitHash.slice(0, 20)}…
                    </span>
                    <VerifyChip id={s.id} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-mono text-xs text-faint">the record awaits its first seal</p>
          )}
        </div>
      </div>
    </section>
  );
}
