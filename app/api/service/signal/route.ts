// GET /api/service/signal — the A2MCP service endpoint (OKX.AI ASP surface).
// Real x402 v2 (exact scheme) on X Layer:
//   · no X-PAYMENT        → 402 + PaymentRequirements (accepts[])
//   · X-PAYMENT present   → decode → verify → settle (facilitator when live,
//                           labelled demo otherwise) → sealed verdict + X-PAYMENT-RESPONSE
//   · ?tier=free          → ruling + confidence + commit hash only (free tier)
import { executeTool } from "@/lib/agent/tools";
import { x402Config } from "@/lib/x402/config";
import {
  buildRequirements,
  decodePaymentHeader,
  encodePaymentChallenge,
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

  // A2MCP service: convene the tribunal on the CALLER'S intent (symbol/side/size),
  // sealing a fresh verdict per call — not replaying the last stored signal.
  const symbol = (url.searchParams.get("symbol") ?? "BTC").toUpperCase();
  const side = url.searchParams.get("side") === "short" ? "short" : "long";
  const sizeUsd = Math.max(1, Math.min(Number(url.searchParams.get("sizeUsd")) || 100, 5000));
  const outcome = await executeTool(
    "convene_tribunal",
    JSON.stringify({ symbol, side, sizeUsd })
  );
  const latest = outcome.ui?.kind === "proposal" ? outcome.ui.signal : null;
  if (!latest) {
    return Response.json(
      { error: outcome.content || "could not convene the tribunal" },
      { status: 400 }
    );
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
  const challengeHeader = encodePaymentChallenge(RESOURCE, [requirements], DESCRIPTION);

  function paymentRequired(body: Record<string, unknown>, status: number = 402): Response {
    return Response.json({ x402Version: 2, ...body }, {
      status,
      headers: { "payment-required": challengeHeader, "x-payment-required": "true" },
    });
  }

  const header = req.headers.get("x-payment");

  // Unpaid → 402 with x402 v2 payment requirements
  if (!header) {
    return paymentRequired({
      error: "payment required",
      mode: cfg.live ? "live" : "demo",
      accepts: [requirements],
    });
  }

  // Decode the X-PAYMENT header
  let payment;
  try {
    payment = decodePaymentHeader(header);
  } catch {
    return paymentRequired({ error: "malformed X-PAYMENT header", accepts: [requirements] });
  }

  // Verify
  const verdict = await verifyPayment(payment, requirements, cfg);
  if (!verdict.isValid) {
    return paymentRequired({
      error: verdict.invalidReason ?? "verification failed",
      accepts: [requirements],
    });
  }

  // Settle (facilitator when live; labelled demo otherwise)
  const settle = await settlePayment(payment, requirements, cfg);
  if (!settle.success) {
    return paymentRequired({
      error: settle.errorReason ?? "settlement failed",
      accepts: [requirements],
    });
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
