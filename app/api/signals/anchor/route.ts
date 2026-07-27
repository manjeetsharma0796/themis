// POST /api/signals/anchor — persist a client-anchored seal tx onto the signal.
import { getSignal, saveSignal } from "@/lib/agent/run";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { id, txHash, explorer } = (await req.json().catch(() => ({}))) as {
    id?: string;
    txHash?: string;
    explorer?: string;
  };
  if (!id || !txHash) return Response.json({ error: "id and txHash required" }, { status: 400 });
  const s = getSignal(id);
  if (!s) return Response.json({ error: "unknown signal" }, { status: 404 });
  s.anchorTx = txHash;
  s.anchorExplorer = explorer ?? `https://www.oklink.com/x-layer-testnet/tx/${txHash}`;
  saveSignal(s);
  return Response.json({ signal: s });
}
