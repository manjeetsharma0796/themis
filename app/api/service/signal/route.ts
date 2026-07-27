// GET /api/service/signal — the A2MCP service endpoint (OKX.AI ASP surface).
// Real x402 v2 (exact scheme) on X Layer:
//   · no X-PAYMENT        → 402 + PaymentRequirements (accepts[])
//   · X-PAYMENT present   → decode → verify → settle (facilitator when live,
//                           labelled demo otherwise) → sealed verdict + X-PAYMENT-RESPONSE
//   · ?tier=free          → ruling + confidence + commit hash only (free tier)
import { listSignals } from "@/lib/agent/run";
import { x402Config } from "@/lib/x402/config";
import {
  buildRequirements,
  decodePaymentHeader,
  encodeSettleResponse,
  settlePayment,
  verifyPayment,
} from "@/lib/x402/server";

export const dynamic = "force-dynamic";

const RESOURCE = "/api/service/signal";
const DESCRIPTION =
  "Themis verified trade verdict — full tribunal transcript, evidence snapshot, and keccak256 commit proof.";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const free = url.searchParams.get("tier") === "free";
  const cfg = x402Config();

  const latest = (await listSignals()).find((s) => s.status !== "cancelled");
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

  const requirements = buildRequirements(RESOURCE, DESCRIPTION, cfg);
  const header = req.headers.get("x-payment");

  // Unpaid → 402 with x402 v2 payment requirements
  if (!header) {
    return Response.json(
      {
        x402Version: 2,
        error: "payment required",
        mode: cfg.live ? "live" : "demo",
        accepts: [requirements],
      },
      { status: 402, headers: { "x-payment-required": "true" } }
    );
  }

  // Decode the X-PAYMENT header
  let payment;
  try {
    payment = decodePaymentHeader(header);
  } catch {
    return Response.json(
      { x402Version: 2, error: "malformed X-PAYMENT header", accepts: [requirements] },
      { status: 402 }
    );
  }

  // Verify
  const verdict = await verifyPayment(payment, requirements, cfg);
  if (!verdict.isValid) {
    return Response.json(
      { x402Version: 2, error: verdict.invalidReason ?? "verification failed", accepts: [requirements] },
      { status: 402 }
    );
  }

  // Settle (facilitator when live; labelled demo otherwise)
  const settle = await settlePayment(payment, requirements, cfg);
  if (!settle.success) {
    return Response.json(
      { x402Version: 2, error: settle.errorReason ?? "settlement failed", accepts: [requirements] },
      { status: 402 }
    );
  }

  const receipt = encodeSettleResponse(settle);
  return Response.json(
    {
      tier: "paid",
      settlement: settle.settlement, // "onchain" | "demo"
      payer: settle.payer,
      txHash: settle.transaction ?? null,
      signal: latest,
      verify: `/api/verify/${latest.id}`,
    },
    { headers: { "x-payment-response": receipt, "payment-response": receipt } }
  );
}
