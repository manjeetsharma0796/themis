// Commit–reveal integrity: the verdict payload is hashed (keccak256) the moment
// it is issued — before execution — so the record provably wasn't edited later.
// ChainAnchor is the pluggable adapter for anchoring the hash on-chain
// (Autonoe DecisionLog on Mantle Sepolia, or XLayer for OKX) — paper mode by default.
import { keccak256, toHex } from "viem";
import type { Signal } from "@/lib/types";

/** Canonical JSON: stable key order so the hash is reproducible anywhere. */
export function canonical(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, val]) => [k, sortKeys(val)])
    );
  }
  return v;
}

export function commitmentPayload(s: Omit<Signal, "commitHash" | "committedAt" | "revealedAt" | "status">) {
  return {
    id: s.id,
    createdAt: s.createdAt,
    intent: s.intent,
    snapshot: {
      symbol: s.snapshot.symbol,
      price: s.snapshot.price,
      rsi14: s.snapshot.rsi14,
      trend: s.snapshot.trend,
      ts: s.snapshot.ts,
    },
    verdict: s.verdict,
  };
}

export function hashSignal(
  s: Omit<Signal, "commitHash" | "committedAt" | "revealedAt" | "status">
): `0x${string}` {
  return keccak256(toHex(canonical(commitmentPayload(s))));
}

export function verifySignal(s: Signal): { ok: boolean; recomputed: `0x${string}` } {
  const recomputed = hashSignal(s);
  return { ok: recomputed === s.commitHash, recomputed };
}

/** On-chain anchoring adapter — implement to write hashes to a chain. */
export interface ChainAnchor {
  anchor(hash: `0x${string}`): Promise<{ txHash: string; explorer: string }>;
}
