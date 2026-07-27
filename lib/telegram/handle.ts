// Handles one Telegram update by running the SAME LLM copilot the web console
// runs (runCopilot) — so Telegram is a full conversation, not just commands.
// The copilot uses the server's env LLM key (e.g. MISTRAL_API_KEY on Vercel);
// BYOK keys live in the browser and aren't available server-side. When no server
// key is set, runCopilot falls back to the deterministic tribunal automatically.
import { runCopilot, type ChatEvent } from "@/lib/agent/copilot";
import { getSignal, saveSignal } from "@/lib/agent/run";
import { openPosition, portfolio } from "@/lib/exec/paper";
import { readJson, writeJson } from "@/lib/store";
import { sendMessage, sendChatAction, answerCallbackQuery } from "@/lib/telegram/api";
import type { ChatMessage } from "@/lib/llm/types";
import type { Signal } from "@/lib/types";

type TgChat = { id: number };
type TgMessage = { text?: string; chat: TgChat };
type TgCallback = { id: string; data?: string; message?: { chat: TgChat } };
type TgUpdate = { message?: TgMessage; callback_query?: TgCallback };

const fmtUsd = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

// Per-chat conversation memory (mirrors the web console's 12-turn window).
const histKey = (chatId: number) => `tg_hist_${chatId}`;
const getHistory = (chatId: number) => readJson<ChatMessage[]>(histKey(chatId), []);
const saveHistory = (chatId: number, msgs: ChatMessage[]) => writeJson(histKey(chatId), msgs.slice(-12));

const START =
  "⚖️ *Themis* — your trade tribunal, now in Telegram.\n\n" +
  "Talk to me like the web console:\n" +
  "• _what's BTC doing?_\n" +
  "• _what can I buy with $500?_\n" +
  "• _should I long SOL?_ → I convene the tribunal and seal a verdict\n\n" +
  "/portfolio — positions & PnL\n/clear — reset our conversation";

export async function handleTelegramUpdate(update: TgUpdate, token: string): Promise<void> {
  if (update.callback_query) {
    await handleCallback(update.callback_query, token);
    return;
  }

  const msg = update.message;
  const chatId = msg?.chat?.id;
  const text = msg?.text?.trim();
  if (!chatId || !text) return;

  if (text === "/start" || text === "/help") {
    await sendMessage(token, chatId, START);
    return;
  }
  if (text === "/clear") {
    await saveHistory(chatId, []);
    await sendMessage(token, chatId, "🧹 Conversation cleared.");
    return;
  }
  if (text.startsWith("/portfolio")) {
    await sendPortfolio(token, chatId);
    return;
  }

  // Everything else → the full copilot (same brain as the website).
  await sendChatAction(token, chatId, "typing");
  const history = await getHistory(chatId);

  let answer = "";
  let proposal: Signal | null = null;
  const emit = (e: ChatEvent) => {
    if (e.type === "token") answer += e.text;
    else if (e.type === "say") answer += (answer && !answer.endsWith("\n") ? "\n\n" : "") + e.text;
    else if (e.type === "endmsg") {
      if (answer.trim() && !answer.endsWith("\n\n")) answer += "\n\n";
    } else if (e.type === "tool") void sendChatAction(token, chatId, "typing");
    else if (e.type === "proposal") proposal = e.signal;
  };

  try {
    await runCopilot(history, text, emit); // server env key (Mistral) — or deterministic fallback
  } catch {
    await sendMessage(token, chatId, "⚠️ I hit a snag thinking that through — try again in a moment.");
    return;
  }

  answer = answer.trim();
  if (answer) await sendMessage(token, chatId, answer.slice(0, 3800));

  const p = proposal as Signal | null;
  if (p && p.status === "pending") {
    await sendMessage(
      token,
      chatId,
      `⚖️ *${p.verdict.ruling}* — ${p.intent.side.toUpperCase()} ${p.intent.symbol} ${fmtUsd(p.verdict.sizeUsd)}\n` +
        `Confidence ${p.verdict.confidence}/100 · sealed \`${p.commitHash.slice(0, 18)}…\``,
      {
        inline_keyboard: [
          [
            { text: "✅ Execute", callback_data: `exec:${p.id}` },
            { text: "❌ Dismiss", callback_data: `dismiss:${p.id}` },
          ],
        ],
      }
    );
  }

  await saveHistory(chatId, [
    ...history,
    { role: "user", content: text },
    { role: "assistant", content: answer || "(acted via tools)" },
  ]);
}

async function sendPortfolio(token: string, chatId: number): Promise<void> {
  const p = await portfolio();
  const lines = p.positions
    .slice(0, 8)
    .map(
      (x) =>
        `${x.status === "open" ? "🟢" : "⚪️"} ${x.side.toUpperCase()} ${x.symbol} ${fmtUsd(x.sizeUsd)} @ ${x.entryPrice.toLocaleString()} → ${x.status === "open" ? fmtUsd(x.unrealizedPnl) + " uPnL" : fmtUsd(x.realizedPnl ?? 0) + " realized"}`
    )
    .join("\n");
  await sendMessage(
    token,
    chatId,
    `📊 Equity ${fmtUsd(p.equity)} (start ${fmtUsd(p.equityStart)})\n` +
      `Realized ${fmtUsd(p.realizedPnl)} · Unrealized ${fmtUsd(p.unrealizedPnl)}\n\n${lines || "No positions yet."}`
  );
}

async function handleCallback(cq: TgCallback, token: string): Promise<void> {
  const [action, id] = (cq.data ?? "").split(":");
  const chatId = cq.message?.chat?.id;
  const signal = id ? await getSignal(id) : null;

  if (!signal || signal.status !== "pending") {
    await answerCallbackQuery(token, cq.id, "Already settled.");
    return;
  }

  if (action === "exec") {
    const position = await openPosition(signal);
    signal.status = "executed";
    signal.revealedAt = Date.now();
    await saveSignal(signal);
    await answerCallbackQuery(token, cq.id, "Executed.");
    if (chatId)
      await sendMessage(
        token,
        chatId,
        `✅ Filled: ${position.side.toUpperCase()} ${position.symbol} ${fmtUsd(position.sizeUsd)} @ ${position.entryPrice.toLocaleString()}\n` +
          `🧾 Receipt: \`${position.receipt.slice(0, 18)}…\`\n/portfolio to track PnL`
      );
    return;
  }

  if (action === "dismiss") {
    signal.status = "cancelled";
    await saveSignal(signal);
    await answerCallbackQuery(token, cq.id, "Dismissed.");
    if (chatId) await sendMessage(token, chatId, "🗂 Case dismissed. The commit stays on the record.");
  }
}
