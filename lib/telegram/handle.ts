// Handles one Telegram update (message or button tap) by reusing the exact same
// tribunal the web console runs. Called from the /api/telegram/webhook route so
// the bot works serverless — no long-running `npm run bot` process required.
import { runAgent, getSignal, saveSignal } from "@/lib/agent/run";
import { openPosition, portfolio } from "@/lib/exec/paper";
import { parseIntent } from "@/lib/agent/intent";
import { sendMessage, answerCallbackQuery } from "@/lib/telegram/api";

type TgChat = { id: number };
type TgMessage = { text?: string; chat: TgChat };
type TgCallback = { id: string; data?: string; message?: { chat: TgChat } };
type TgUpdate = { message?: TgMessage; callback_query?: TgCallback };

const fmtUsd = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

const START =
  "⚖️ *Themis* — the trade tribunal.\n\n" +
  "Send an intent like:\n`long BTC with $200`\n`short SOL 150`\n\n" +
  "An advocate argues it, a skeptic prosecutes it, the judge rules on live market " +
  "evidence — the verdict is hash-committed *before* execution, so the record " +
  "can't be doctored.\n\n/portfolio — positions & PnL";

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

  if (text.startsWith("/portfolio")) {
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
    return;
  }

  if (parseIntent(text).action !== "trade") {
    await sendMessage(
      token,
      chatId,
      "I hear a question, not a motion. Try `long BTC with $200` — supported: BTC, ETH, SOL, SUI, MNT."
    );
    return;
  }

  // Run the tribunal with no artificial pacing (webhook = single reply).
  const signal = await runAgent(text, () => {}, 0);
  if (!signal) return;

  if (signal.verdict.ruling === "REJECT") {
    await sendMessage(
      token,
      chatId,
      `🚫 Motion denied (confidence ${signal.verdict.confidence}/100).\n` +
        `Commit: \`${signal.commitHash.slice(0, 18)}…\` — the rejection is on the record too.`
    );
    return;
  }

  await sendMessage(
    token,
    chatId,
    `⚖️ *${signal.verdict.ruling}* — ${signal.intent.side.toUpperCase()} ${signal.intent.symbol} ${fmtUsd(signal.verdict.sizeUsd)}\n` +
      `Confidence ${signal.verdict.confidence}/100\n` +
      `Commit: \`${signal.commitHash.slice(0, 18)}…\` (sealed before execution)`,
    {
      inline_keyboard: [
        [
          { text: "✅ Execute", callback_data: `exec:${signal.id}` },
          { text: "❌ Dismiss", callback_data: `dismiss:${signal.id}` },
        ],
      ],
    }
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
