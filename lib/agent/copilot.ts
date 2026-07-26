// The copilot loop — proactive trading assistant. Runs a tool-calling loop over
// the fallback router, streaming events (narration, tool calls, inline charts,
// ruling cards, suggestion chips). Falls back to the deterministic tribunal when
// no LLM keys are configured, so the app always works.
import type { ChatMessage } from "@/lib/llm/types";
import type { Signal } from "@/lib/types";
import { llmChat, NoProvidersError } from "@/lib/llm/router";
import { hasAnyKey, type RuntimeConfig } from "@/lib/llm/providers";
import { TOOL_DEFS, executeTool, type ToolOutcome } from "@/lib/agent/tools";
import { parseIntent } from "@/lib/agent/intent";
import { setupMcp } from "@/lib/mcp/client";

export type ChatEvent =
  | { type: "provider"; provider: string }
  | { type: "say"; text: string }
  | { type: "tool"; name: string; detail: string }
  | { type: "chart"; symbol: string; interval: string }
  | { type: "proposal"; signal: Signal }
  | { type: "chips"; items: string[] }
  | { type: "error"; message: string };

const SYSTEM = `You are Themis — a sharp, proactive crypto trading copilot. You help the user read markets and act on them.

Rules:
- Be concise and human. A little wit is fine; never verbose.
- Use tools for anything factual. Call get_market before giving a market view. Call show_chart whenever price action is discussed or the user wants to see a chart. Call get_portfolio for balance/wallet/PnL questions. Call affordability for "what can I buy with $X". Call list_markets if asked what's tradable.
- When the user signals intent to trade or invest (e.g. "I want to invest in SOL", "should I long BTC?"), be proactive: check the market first, then call convene_tribunal to produce a sealed verdict + ruling card. If size is unspecified, use $100 and say so.
- Supported markets only: BTC, ETH, SOL, SUI, MNT (vs USDT). If asked about others, say so plainly.
- Never claim a trade executed — execution happens when the user taps Execute on the ruling card. Trades are paper.
- After acting, briefly say what you did and what they can do next.`;

const DEFAULT_CHIPS = ["Show me the BTC chart", "What can I buy with $500?", "Should I long SOL?"];
const MAX_ROUNDS = 6;

function summarizeArgs(raw: string): string {
  try {
    const o = JSON.parse(raw || "{}") as Record<string, unknown>;
    const vals = Object.values(o);
    return vals.length ? vals.map(String).join(" ") : "";
  } catch {
    return "";
  }
}

async function suggestChips(lastAnswer: string, cfg?: RuntimeConfig): Promise<string[]> {
  try {
    const r = await llmChat([
      {
        role: "system",
        content:
          'Output ONLY a JSON array of exactly 3 short next-message ideas (max 6 words each) the user might tap next. No prose.',
      },
      { role: "user", content: `The assistant just said: "${lastAnswer.slice(0, 400)}". Suggestions:` },
    ], undefined, undefined, cfg);
    const match = (r.content ?? "").match(/\[[\s\S]*\]/);
    if (match) {
      const arr = JSON.parse(match[0]);
      if (Array.isArray(arr) && arr.length) return arr.slice(0, 3).map(String);
    }
  } catch {
    /* fall through to defaults */
  }
  return DEFAULT_CHIPS;
}

/** Deterministic path when no LLM keys are set — keeps the app usable. */
async function runFallback(userText: string, emit: (e: ChatEvent) => void) {
  emit({ type: "tool", name: "parse_intent", detail: userText });
  const intent = parseIntent(userText);
  if (intent.action !== "trade") {
    emit({
      type: "say",
      text: "No LLM key is configured, so I'm in basic mode. I can still run the tribunal — try e.g. “long BTC with $200”. Supported: BTC, ETH, SOL, SUI, MNT.",
    });
    emit({ type: "chips", items: DEFAULT_CHIPS });
    return;
  }
  emit({ type: "say", text: `Convening the tribunal on ${intent.side} ${intent.symbol} $${intent.sizeUsd}…` });
  const outcome = await executeTool(
    "convene_tribunal",
    JSON.stringify({ symbol: intent.symbol, side: intent.side, sizeUsd: intent.sizeUsd })
  );
  emit({ type: "tool", name: "convene_tribunal", detail: `${intent.side} ${intent.symbol} $${intent.sizeUsd}` });
  if (outcome.ui?.kind === "proposal") emit({ type: "proposal", signal: outcome.ui.signal });
  emit({ type: "say", text: outcome.content });
  emit({ type: "chips", items: DEFAULT_CHIPS });
}

export async function runCopilot(
  history: ChatMessage[],
  userText: string,
  emit: (e: ChatEvent) => void,
  cfg?: RuntimeConfig
): Promise<void> {
  if (!hasAnyKey(cfg)) return runFallback(userText, emit);

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    ...history,
    { role: "user", content: userText },
  ];

  const mcp = await setupMcp(cfg?.mcpServers);
  const tools = mcp.tools.length ? [...TOOL_DEFS, ...mcp.tools] : TOOL_DEFS;

  let announcedProvider = false;
  let lastAnswer = "";

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const result = await llmChat(messages, tools, (a) => {
        if (a.ok && !announcedProvider) {
          announcedProvider = true;
          emit({ type: "provider", provider: a.provider });
        }
      }, cfg);

      if (result.content) {
        emit({ type: "say", text: result.content });
        lastAnswer = result.content;
      }

      messages.push({
        role: "assistant",
        content: result.content,
        tool_calls: result.toolCalls.length ? result.toolCalls : undefined,
      });

      if (result.toolCalls.length === 0) break;

      for (const tc of result.toolCalls) {
        emit({ type: "tool", name: tc.function.name, detail: summarizeArgs(tc.function.arguments) });
        const outcome: ToolOutcome = mcp.routes.has(tc.function.name)
          ? { content: await mcp.call(tc.function.name, tc.function.arguments) }
          : await executeTool(tc.function.name, tc.function.arguments);
        if (outcome.ui?.kind === "chart") {
          emit({ type: "chart", symbol: outcome.ui.symbol, interval: outcome.ui.interval });
        } else if (outcome.ui?.kind === "proposal") {
          emit({ type: "proposal", signal: outcome.ui.signal });
        }
        messages.push({ role: "tool", tool_call_id: tc.id, content: outcome.content });
      }
    }

    emit({ type: "chips", items: await suggestChips(lastAnswer, cfg) });
  } catch (err) {
    if (err instanceof NoProvidersError) return runFallback(userText, emit);
    emit({
      type: "error",
      message: err instanceof Error ? err.message : "the copilot hit an error",
    });
    emit({ type: "chips", items: DEFAULT_CHIPS });
  } finally {
    await mcp.close();
  }
}
