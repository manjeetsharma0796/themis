// Themis — shared domain types

export type Side = "long" | "short";

export type Intent = {
  action: "trade" | "question";
  symbol: string; // BTC, ETH, SOL, SUI, MNT
  side: Side;
  sizeUsd: number;
  raw: string;
};

export type MarketSnapshot = {
  symbol: string;
  price: number;
  chg24hPct: number;
  volume24h: number;
  rsi14: number;
  ema20: number;
  ema50: number;
  atr14: number;
  atrPct: number; // atr as % of price
  trend: "up" | "down" | "flat";
  ts: number;
};

export type TribunalLine = {
  role: "advocate" | "skeptic" | "judge";
  text: string;
};

export type Verdict = {
  ruling: "APPROVE" | "REJECT" | "REVISE";
  confidence: number; // 0..100
  sizeUsd: number; // possibly revised down
  rationale: string;
};

export type Signal = {
  id: string;
  createdAt: number;
  intent: Intent;
  snapshot: MarketSnapshot;
  transcript: TribunalLine[];
  verdict: Verdict;
  commitHash: `0x${string}`;
  committedAt: number;
  revealedAt: number | null;
  status: "pending" | "executed" | "cancelled" | "rejected";
  anchorTx?: string; // X Layer tx hash if the seal was anchored on-chain
  anchorExplorer?: string; // explorer URL for the anchor tx
};

export type Position = {
  id: string;
  signalId: string;
  symbol: string;
  side: Side;
  sizeUsd: number;
  qty: number;
  entryPrice: number;
  openedAt: number;
  status: "open" | "closed";
  closedAt: number | null;
  closePrice: number | null;
  realizedPnl: number | null;
  receipt: `0x${string}`; // paper fill receipt (keccak of fill); chain adapter replaces with tx hash
};

export type PortfolioView = {
  equityStart: number;
  cash: number;
  positions: (Position & { markPrice: number; unrealizedPnl: number })[];
  realizedPnl: number;
  unrealizedPnl: number;
  equity: number;
};

// Server-Sent Event payloads streamed during an agent run
export type RunEvent =
  | { type: "step"; label: string }
  | { type: "tool"; name: string; detail: string }
  | { type: "say"; role: TribunalLine["role"]; text: string }
  | { type: "verdict"; verdict: Verdict }
  | { type: "commit"; hash: string; id: string }
  | { type: "proposal"; signal: Signal }
  | { type: "error"; message: string };

export const SYMBOLS: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  SUI: "SUIUSDT",
  MNT: "MNTUSDT",
};
