// GET /api/market/book?symbol=SOL&depth=14 — OKX order-book proxy for the live
// depth panel (avoids browser CORS, mirrors /api/market/candles).
import { getOrderBook, bookMetrics } from "@/lib/market/okx";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol") ?? "BTC";
  const depth = Math.min(50, Math.max(5, parseInt(url.searchParams.get("depth") ?? "14", 10)));
  try {
    const book = await getOrderBook(symbol, depth);
    return Response.json({ book, metrics: bookMetrics(book) });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "book failed" },
      { status: 502 }
    );
  }
}
