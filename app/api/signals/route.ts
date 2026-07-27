// GET /api/signals — the verdict ledger (newest first)
import { listSignals } from "@/lib/agent/run";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await listSignals());
}
