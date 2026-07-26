// POST /api/execute — user confirmed (or cancelled) a pending proposal
import { getSignal, saveSignal } from "@/lib/agent/run";
import { openPosition } from "@/lib/exec/paper";
import { anchorSeal } from "@/lib/chain/anchor";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { id, decision } = (await req.json().catch(() => ({}))) as {
    id?: string;
    decision?: "confirm" | "cancel";
  };
  if (!id || !decision) {
    return Response.json({ error: "id and decision required" }, { status: 400 });
  }
  const signal = getSignal(id);
  if (!signal) return Response.json({ error: "unknown signal" }, { status: 404 });
  if (signal.status !== "pending") {
    return Response.json({ error: `signal is ${signal.status}` }, { status: 409 });
  }

  if (decision === "cancel") {
    signal.status = "cancelled";
    saveSignal(signal);
    return Response.json({ signal });
  }

  const position = await openPosition(signal);
  signal.status = "executed";
  signal.revealedAt = Date.now(); // reveal at execution: payload now public + verifiable
  const anchor = await anchorSeal(signal.commitHash);
  if (anchor) {
    signal.anchorTx = anchor.txHash;
    signal.anchorExplorer = anchor.explorer;
  }
  saveSignal(signal);
  return Response.json({ signal, position });
}
