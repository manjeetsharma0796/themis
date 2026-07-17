// GET /api/service/signal — the A2MCP service endpoint (OKX.AI ASP surface).
// Without payment: HTTP 402 + x402-style payment terms (demo shape; production
// uses the OKX Payment SDK). With X-PAYMENT header: full latest verdict.
// ?tier=free: redacted verdict (ruling + confidence only) — the free tier.
import { listSignals } from "@/lib/agent/run";

export const dynamic = "force-dynamic";

const PRICE_USD = "0.10";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const free = url.searchParams.get("tier") === "free";
  const paid = req.headers.get("x-payment") !== null;

  const latest = listSignals().find((s) => s.status !== "cancelled");
  if (!latest) {
    return Response.json({ error: "no signals issued yet" }, { status: 404 });
  }

  if (free) {
    return Response.json({
      tier: "free",
      id: latest.id,
      symbol: latest.intent.symbol,
      ruling: latest.verdict.ruling,
      confidence: latest.verdict.confidence,
      commitHash: latest.commitHash,
      committedAt: latest.committedAt,
      upgrade: "Full transcript + rationale via x402 payment — see 402 terms.",
    });
  }

  if (!paid) {
    return Response.json(
      {
        x402Version: 1,
        error: "payment required",
        accepts: [
          {
            scheme: "exact",
            network: "xlayer",
            maxAmountRequired: PRICE_USD,
            asset: "USDT",
            payTo: "themis.okx.ai (assigned at ASP listing)",
            description:
              "Themis verified trade verdict — full tribunal transcript, evidence snapshot, and keccak256 commit proof.",
            resource: "/api/service/signal",
          },
        ],
      },
      { status: 402 }
    );
  }

  return Response.json({
    tier: "paid",
    signal: latest,
    verify: `/api/verify/${latest.id}`,
  });
}
