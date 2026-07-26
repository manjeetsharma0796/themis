// Agent tools — thin, finance-focused wrappers over the existing libs.
// Each executor returns { content } (fed back to the model) and an optional
// { ui } side-effect the chat renders inline (a chart, or a tribunal ruling card).
import type { ToolDef } from "@/lib/llm/types";
import type { Intent, Side, Signal } from "@/lib/types";
import { buildSnapshot } from "@/lib/market/indicators";
import { getTicker, SUPPORTED } from "@/lib/market/okx";
import { advocate, judge, judgeLine, skeptic } from "@/lib/agent/tribunal";
import { hashSignal } from "@/lib/agent/commit";
import { saveSignal } from "@/lib/agent/run";
import { portfolio } from "@/lib/exec/paper";

export type ToolUi =
  | { kind: "chart"; symbol: string; interval: string }
  | { kind: "proposal"; signal: Signal };

export type ToolOutcome = { content: string; ui?: ToolUi };

export const TOOL_DEFS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "list_markets",
      description: "List the tradable markets Themis supports.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_market",
      description:
        "Get a live market snapshot for a symbol: price, 24h change, RSI, EMA20/50, ATR, trend. Use before forming a view.",
      parameters: {
        type: "object",
        properties: { symbol: { type: "string", description: "e.g. BTC, ETH, SOL, SUI, MNT" } },
        required: ["symbol"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_chart",
      description:
        "Render a live candlestick chart for a symbol INLINE in the chat. Use whenever the user wants to see price action or you reference a chart.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string" },
          interval: { type: "string", enum: ["15", "60", "240"], description: "15m, 1H, or 4H. Default 60." },
        },
        required: ["symbol"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_portfolio",
      description: "Get the user's wallet/portfolio: equity, cash, realized/unrealized PnL, open positions.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "affordability",
      description: "Given a USD amount, show roughly how much of each supported coin it buys at live prices.",
      parameters: {
        type: "object",
        properties: { usd: { type: "number", description: "USD amount, e.g. 399" } },
        required: ["usd"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "convene_tribunal",
      description:
        "Run the trade tribunal (Advocate vs Skeptic, Judge rules on live evidence) for a proposed trade. Returns a sealed verdict and shows a ruling card the user can execute. Use when the user wants to act / decide on a trade.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string" },
          side: { type: "string", enum: ["long", "short"] },
          sizeUsd: { type: "number", description: "position size in USD" },
        },
        required: ["symbol", "side", "sizeUsd"],
      },
    },
  },
];

function unsupported(symbol: string): ToolOutcome {
  return { content: `Unsupported symbol "${symbol}". Supported: ${SUPPORTED.join(", ")}.` };
}

export async function executeTool(name: string, rawArgs: string): Promise<ToolOutcome> {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { content: `Could not parse arguments for ${name}.` };
  }

  switch (name) {
    case "list_markets":
      return { content: `Supported markets (vs USDT on OKX): ${SUPPORTED.join(", ")}.` };

    case "get_market": {
      const sym = String(args.symbol ?? "").toUpperCase();
      if (!SUPPORTED.includes(sym)) return unsupported(sym);
      const s = await buildSnapshot(sym);
      return {
        content:
          `${s.symbol}: price ${s.price.toLocaleString()}, 24h ${s.chg24hPct.toFixed(2)}%, ` +
          `RSI ${s.rsi14.toFixed(0)}, EMA20 ${s.ema20.toFixed(2)} vs EMA50 ${s.ema50.toFixed(2)}, ` +
          `ATR ${s.atrPct.toFixed(2)}%, trend ${s.trend}.`,
      };
    }

    case "show_chart": {
      const sym = String(args.symbol ?? "").toUpperCase();
      if (!SUPPORTED.includes(sym)) return unsupported(sym);
      const interval = ["15", "60", "240"].includes(String(args.interval)) ? String(args.interval) : "60";
      const label = interval === "15" ? "15m" : interval === "240" ? "4H" : "1H";
      return {
        content: `Displayed a live ${label} candlestick chart for ${sym}/USDT inline.`,
        ui: { kind: "chart", symbol: sym, interval },
      };
    }

    case "get_portfolio": {
      const p = await portfolio();
      const open = p.positions.filter((x) => x.status === "open");
      return {
        content:
          `Equity $${p.equity.toFixed(2)} (start $${p.equityStart}). ` +
          `Cash $${p.cash.toFixed(2)}. Realized $${p.realizedPnl.toFixed(2)}, unrealized $${p.unrealizedPnl.toFixed(2)}. ` +
          `Open: ${open.length ? open.map((x) => `${x.side} ${x.symbol} $${x.sizeUsd}`).join("; ") : "none"}.`,
      };
    }

    case "affordability": {
      const amt = Number(args.usd);
      if (!amt || amt <= 0) return { content: "Provide a positive USD amount." };
      const lines: string[] = [];
      for (const sym of SUPPORTED) {
        try {
          const t = await getTicker(sym);
          lines.push(`${(amt / t.price).toPrecision(4)} ${sym} (@ $${t.price.toLocaleString()})`);
        } catch {
          /* skip a symbol the feed can't price */
        }
      }
      return { content: `With $${amt} you could buy about: ${lines.join(" · ")}.` };
    }

    case "convene_tribunal": {
      const sym = String(args.symbol ?? "").toUpperCase();
      if (!SUPPORTED.includes(sym)) return unsupported(sym);
      const side: Side = args.side === "short" ? "short" : "long";
      const size = Math.max(1, Math.min(Number(args.sizeUsd) || 100, 5000));
      const intent: Intent = { action: "trade", symbol: sym, side, sizeUsd: size, raw: `${side} ${sym} ${size}` };
      const snapshot = await buildSnapshot(sym);
      const adv = advocate(intent, snapshot);
      const skp = skeptic(intent, snapshot);
      const verdict = judge(intent, snapshot);
      const jl = judgeLine(verdict);
      const id = `sig_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
      const base = { id, createdAt: Date.now(), intent, snapshot, transcript: [adv, skp, jl], verdict };
      const commitHash = hashSignal(base);
      const signal: Signal = {
        ...base,
        commitHash,
        committedAt: Date.now(),
        revealedAt: null,
        status: verdict.ruling === "REJECT" ? "rejected" : "pending",
      };
      saveSignal(signal);
      return {
        content:
          `Tribunal verdict on ${side} ${sym} $${size}: ${verdict.ruling} ` +
          `(confidence ${verdict.confidence}/100). ${verdict.rationale} ` +
          (verdict.ruling === "REJECT"
            ? "No execution offered."
            : "A ruling card is shown for the user to execute or dismiss."),
        ui: { kind: "proposal", signal },
      };
    }

    default:
      return { content: `Unknown tool: ${name}.` };
  }
}
