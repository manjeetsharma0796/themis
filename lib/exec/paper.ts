// Paper execution engine — real prices, simulated fills, honest receipts.
// Swappable for a ChainAnchor-backed executor (OKX X Layer) later.
import { keccak256, toHex } from "viem";
import type { PortfolioView, Position, Side, Signal } from "@/lib/types";
import { readJson, writeJson } from "@/lib/store";
import { getTicker } from "@/lib/market/okx";

const EQUITY_START = 10_000;

export async function listPositions(): Promise<Position[]> {
  return readJson<Position[]>("positions", []);
}

async function savePositions(p: Position[]): Promise<void> {
  await writeJson("positions", p);
}

export async function openPosition(signal: Signal): Promise<Position> {
  const { price } = await getTicker(signal.intent.symbol);
  const sizeUsd = signal.verdict.sizeUsd;
  const position: Position = {
    id: `pos_${signal.id}`,
    signalId: signal.id,
    symbol: signal.intent.symbol,
    side: signal.intent.side as Side,
    sizeUsd,
    qty: sizeUsd / price,
    entryPrice: price,
    openedAt: Date.now(),
    status: "open",
    closedAt: null,
    closePrice: null,
    realizedPnl: null,
    receipt: keccak256(
      toHex(`${signal.id}:${price}:${sizeUsd}:${Date.now()}`)
    ),
  };
  const all = await listPositions();
  all.unshift(position);
  await savePositions(all);
  return position;
}

export async function closePosition(id: string): Promise<Position | null> {
  const all = await listPositions();
  const pos = all.find((p) => p.id === id && p.status === "open");
  if (!pos) return null;
  const { price } = await getTicker(pos.symbol);
  const dir = pos.side === "long" ? 1 : -1;
  pos.closePrice = price;
  pos.closedAt = Date.now();
  pos.realizedPnl = (price - pos.entryPrice) * pos.qty * dir;
  pos.status = "closed";
  await savePositions(all);
  return pos;
}

export async function portfolio(): Promise<PortfolioView> {
  const all = await listPositions();
  const marks = new Map<string, number>();
  for (const sym of new Set(all.filter((p) => p.status === "open").map((p) => p.symbol))) {
    try {
      marks.set(sym, (await getTicker(sym)).price);
    } catch {
      // keep entry price as mark if the feed hiccups
    }
  }
  const positions = all.map((p) => {
    const mark = p.status === "open" ? (marks.get(p.symbol) ?? p.entryPrice) : (p.closePrice ?? p.entryPrice);
    const dir = p.side === "long" ? 1 : -1;
    const upnl = p.status === "open" ? (mark - p.entryPrice) * p.qty * dir : 0;
    return { ...p, markPrice: mark, unrealizedPnl: upnl };
  });
  const realizedPnl = all.reduce((s, p) => s + (p.realizedPnl ?? 0), 0);
  const unrealizedPnl = positions.reduce((s, p) => s + p.unrealizedPnl, 0);
  const openCost = all.filter((p) => p.status === "open").reduce((s, p) => s + p.sizeUsd, 0);
  return {
    equityStart: EQUITY_START,
    cash: EQUITY_START + realizedPnl - openCost,
    positions,
    realizedPnl,
    unrealizedPnl,
    equity: EQUITY_START + realizedPnl + unrealizedPnl,
  };
}
