// GET /api/service/signal — the A2MCP service endpoint (OKX.AI ASP surface).
// Real x402 v2 (exact scheme) on X Layer MAINNET (eip155:196):
//   · no X-PAYMENT        → 402 IMMEDIATELY + base64 PAYMENT-REQUIRED challenge
//                           header (so the caller can read asset/amount/payTo
//                           without waiting on any tribunal work)
//   · X-PAYMENT present   → decode → verify → settle (facilitator when live,
//                           labelled demo otherwise) → THEN convene the tribunal
//                           → sealed verdict + X-PAYMENT-RESPONSE
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
import type { SettleResponse } from "@/lib/x402/types";

export const dynamic = "force-dynamic";

const RESOURCE = "/api/service/signal";
const DESCRIPTION =
  "Themis verified trade verdict — full tribunal transcript, evidence snapshot, and keccak256 commit proof.";

async function handle(req: Request) {
  const url = new URL(req.url);
  const free = url.searchParams.get("tier") === "free";
  const cfg = x402Config();

  const symbol = (url.searchParams.get("symbol") ?? "BTC").toUpperCase();
  const side = url.searchParams.get("side") === "short" ? "short" : "long";
  const sizeUsd = Math.max(1, Math.min(Number(url.searchParams.get("sizeUsd")) || 100, 5000));

  const requirements = buildRequirements(RESOURCE, DESCRIPTION, cfg);
  const challengeHeader = encodePaymentChallenge(RESOURCE, [requirements]);

  // Every 402 carries the base64 x402 challenge in the PAYMENT-REQUIRED header.
  function paymentRequired(body: Record<string, unknown>, status = 402): Response {
    return Response.json(
      { x402Version: 2, ...body },
      {
        status,
        headers: {
          // HTTP header names are case-insensitive (and HTTP/2 lowercases them on
          // the wire), so ONE key is correct — duplicates would comma-join the
          // value and break base64 decoding.
          "payment-required": challengeHeader,
          "x-payment-required": "true",
        },
      }
    );
  }

  const header = req.headers.get("x-payment");

  // Paid tier + unpaid → return the challenge INSTANTLY, before any tribunal work,
  // so the caller reliably obtains the payment requirements (asset/amount/payTo).
  if (!free && !header) {
    return paymentRequired({
      error: "payment required",
      mode: cfg.live ? "live" : "demo",
      accepts: [requirements],
    });
  }

  // Paid tier + payment header → decode → verify → settle BEFORE doing the work.
  let settle: SettleResponse | undefined;
  if (!free) {
    let payment;
    try {
      payment = decodePaymentHeader(header as string);
    } catch {
      return paymentRequired({ error: "malformed X-PAYMENT header", accepts: [requirements] });
    }
    const verdict = await verifyPayment(payment, requirements, cfg);
    if (!verdict.isValid) {
      return paymentRequired({
        error: verdict.invalidReason ?? "verification failed",
        accepts: [requirements],
      });
    }
    settle = await settlePayment(payment, requirements, cfg);
    if (!settle.success) {
      return paymentRequired({
        error: settle.errorReason ?? "settlement failed",
        accepts: [requirements],
      });
    }
  }

  // Convene the tribunal on the CALLER'S intent, sealing a fresh verdict per call
  // (free tier, or paid tier once payment has settled).
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

  const receipt = encodeSettleResponse(settle as SettleResponse);
  return Response.json(
    {
      tier: "paid",
      settlement: (settle as SettleResponse).settlement, // "onchain" | "demo"
      payer: (settle as SettleResponse).payer,
      txHash: (settle as SettleResponse).transaction ?? null,
      signal: latest,
      verify: `/api/verify/${latest.id}`,
    },
    { headers: { "x-payment-response": receipt, "payment-response": receipt } }
  );
}

// A2MCP callers may probe via GET or POST — accept both. Params come from the
// query string either way; the x402 payment flow itself is header-driven.
export const GET = handle;
export const POST = handle;
