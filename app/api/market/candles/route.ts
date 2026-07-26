// GET /api/market/candles?symbol=BTC&interval=60 — OKX proxy for the chart
import { getCandles } from "@/lib/market/okx";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol") ?? "BTC";
  const interval = (url.searchParams.get("interval") ?? "60") as "15" | "60" | "240";
  try {
    return Response.json(await getCandles(symbol, interval, 120));
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "candles failed" },
      { status: 502 }
    );
  }
}
