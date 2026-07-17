// GET /api/market/ticker?symbol=BTC — live price for header/PnL marks
import { getTicker } from "@/lib/market/bybit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const symbol = new URL(req.url).searchParams.get("symbol") ?? "BTC";
  try {
    return Response.json(await getTicker(symbol));
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "ticker failed" },
      { status: 502 }
    );
  }
}
