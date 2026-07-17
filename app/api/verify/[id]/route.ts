// GET /api/verify/:id — recompute the keccak256 commitment and compare
import { getSignal } from "@/lib/agent/run";
import { verifySignal, commitmentPayload } from "@/lib/agent/commit";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const signal = getSignal(id);
  if (!signal) return Response.json({ error: "unknown signal" }, { status: 404 });
  const { ok, recomputed } = verifySignal(signal);
  return Response.json({
    id,
    ok,
    committedHash: signal.commitHash,
    recomputedHash: recomputed,
    committedAt: signal.committedAt,
    revealedAt: signal.revealedAt,
    payload: commitmentPayload(signal),
  });
}
