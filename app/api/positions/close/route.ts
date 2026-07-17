// POST /api/positions/close — close an open paper position at live price
import { closePosition } from "@/lib/exec/paper";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  const position = await closePosition(id);
  if (!position) return Response.json({ error: "not an open position" }, { status: 404 });
  return Response.json({ position });
}
