// POST /api/trade — manual buy/sell straight from the chart. Seals + executes a
// paper position directly (no tribunal), so even hand-placed trades land on the
// same integrity record: committed hash → depth-weighted fill → anchorable seal.
import type { Intent, Signal, Verdict } from "@/lib/types";
import { SUPPORTED } from "@/lib/market/okx";
import { buildSnapshot } from "@/lib/market/indicators";
import { hashSignal } from "@/lib/agent/commit";
import { saveSignal } from "@/lib/agent/run";
import { openPosition } from "@/lib/exec/paper";
import { anchorSeal } from "@/lib/chain/anchor";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    symbol?: string;
    side?: string;
    sizeUsd?: number;
  };
  const symbol = String(body.symbol ?? "").toUpperCase();
  const side: Intent["side"] = body.side === "short" ? "short" : "long";
  const sizeUsd = Math.max(1, Math.min(Number(body.sizeUsd) || 0, 5000));

  if (!SUPPORTED.includes(symbol)) {
    return Response.json({ error: `Unsupported symbol. Try: ${SUPPORTED.join(", ")}.` }, { status: 400 });
  }
  if (!sizeUsd) return Response.json({ error: "Provide a positive USD size." }, { status: 400 });

  const snapshot = await buildSnapshot(symbol, side, sizeUsd);
  const intent: Intent = { action: "trade", symbol, side, sizeUsd, raw: `manual ${side} ${symbol} ${sizeUsd}` };
  const verdict: Verdict = {
    ruling: "MANUAL",
    confidence: 100,
    sizeUsd,
    rationale: "Manual order — placed directly by the trader from the chart, then sealed for the record.",
  };
  const id = `sig_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
  const base = { id, createdAt: Date.now(), intent, snapshot, transcript: [], verdict };
  const commitHash = hashSignal(base);

  const signal: Signal = {
    ...base,
    commitHash,
    committedAt: Date.now(),
    revealedAt: Date.now(), // manual = commit + reveal at once
    status: "executed",
  };
  const position = await openPosition(signal);
  const anchor = await anchorSeal(commitHash); // server-side if ANCHOR_PRIVATE_KEY set
  if (anchor) {
    signal.anchorTx = anchor.txHash;
    signal.anchorExplorer = anchor.explorer;
  }
  await saveSignal(signal);
  return Response.json({ signal, position });
}
