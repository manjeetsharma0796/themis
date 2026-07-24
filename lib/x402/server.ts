// Spec-compliant x402 v2 resource-server helpers (exact scheme).
// Real verification + settlement go through a facilitator (OKX's on X Layer,
// via X402_FACILITATOR_URL). With no facilitator configured we run in DEMO mode:
// the payment is structurally validated and a receipt is returned that is
// explicitly labelled settlement:"demo" — we never fake an on-chain settle.
import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from "@/lib/x402/types";
import { atomicAmount, x402Config, type X402Config } from "@/lib/x402/config";

const ZERO = "0x0000000000000000000000000000000000000000";

export function buildRequirements(
  resource: string,
  description: string,
  cfg: X402Config = x402Config()
): PaymentRequirements {
  return {
    scheme: "exact",
    network: cfg.network,
    amount: atomicAmount(cfg),
    asset: cfg.asset || ZERO,
    payTo: cfg.payTo || ZERO,
    maxTimeoutSeconds: 60,
    resource,
    description,
    mimeType: "application/json",
    extra: { name: cfg.assetName, version: cfg.assetVersion },
  };
}

export function decodePaymentHeader(header: string): PaymentPayload {
  const json = Buffer.from(header, "base64").toString("utf-8");
  return JSON.parse(json) as PaymentPayload;
}

export function encodeSettleResponse(res: SettleResponse): string {
  return Buffer.from(JSON.stringify(res)).toString("base64");
}

/** Shape + amount + network checks — the local guard, and demo-mode verification. */
function structuralCheck(p: PaymentPayload, req: PaymentRequirements): VerifyResponse {
  if (p?.x402Version !== 2) return { isValid: false, invalidReason: "unsupported x402Version" };
  if (p.accepted?.scheme !== "exact") return { isValid: false, invalidReason: "unsupported scheme" };
  if (p.accepted?.network !== req.network)
    return { isValid: false, invalidReason: `network mismatch (want ${req.network})` };
  const auth = p.payload?.authorization;
  if (!auth?.from || !p.payload?.signature)
    return { isValid: false, invalidReason: "missing authorization or signature" };
  try {
    if (BigInt(auth.value || "0") < BigInt(req.amount))
      return { isValid: false, invalidReason: "insufficient amount" };
  } catch {
    return { isValid: false, invalidReason: "unparseable amount" };
  }
  return { isValid: true, payer: auth.from };
}

async function facilitator(
  path: "verify" | "settle",
  body: unknown,
  cfg: X402Config
): Promise<unknown> {
  const res = await fetch(`${cfg.facilitatorUrl}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`facilitator /${path} → ${res.status}`);
  return res.json();
}

export async function verifyPayment(
  p: PaymentPayload,
  req: PaymentRequirements,
  cfg: X402Config = x402Config()
): Promise<VerifyResponse> {
  const local = structuralCheck(p, req);
  if (!local.isValid || !cfg.live) return local; // demo mode stops at structural
  try {
    return (await facilitator(
      "verify",
      { x402Version: 2, paymentPayload: p, paymentRequirements: req },
      cfg
    )) as VerifyResponse;
  } catch (err) {
    return { isValid: false, invalidReason: err instanceof Error ? err.message : "verify failed" };
  }
}

export async function settlePayment(
  p: PaymentPayload,
  req: PaymentRequirements,
  cfg: X402Config = x402Config()
): Promise<SettleResponse> {
  if (!cfg.live) {
    return {
      success: true,
      settlement: "demo",
      network: req.network,
      payer: p.payload?.authorization?.from,
    };
  }
  try {
    const r = (await facilitator(
      "settle",
      { x402Version: 2, paymentPayload: p, paymentRequirements: req },
      cfg
    )) as SettleResponse;
    return { ...r, settlement: "onchain" };
  } catch (err) {
    return { success: false, errorReason: err instanceof Error ? err.message : "settle failed" };
  }
}
