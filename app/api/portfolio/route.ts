// GET /api/portfolio — positions marked to live prices
import { portfolio } from "@/lib/exec/paper";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await portfolio());
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "portfolio failed" },
      { status: 500 }
    );
  }
}
