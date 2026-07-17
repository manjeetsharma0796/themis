// Themis Telegram client — the same tribunal agent, in your pocket.
// Flow: send an intent ("long BTC with $200") → live tribunal messages →
// verdict card with inline ✅ Execute / ❌ Dismiss → paper execution + receipt.
// Runs only when TELEGRAM_BOT_TOKEN is set:  npm run bot
import { Bot, InlineKeyboard } from "grammy";
import { runAgent, getSignal, saveSignal } from "../lib/agent/run";
import { openPosition, portfolio } from "../lib/exec/paper";
import type { RunEvent } from "../lib/types";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN not set — bot not started.");
  process.exit(1);
}

const bot = new Bot(token);

const fmtUsd = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

bot.command("start", (ctx) =>
  ctx.reply(
    "⚖️ *Themis* — the trade tribunal.\n\n" +
      "Send an intent like:\n`long BTC with $200`\n`short SOL 150`\n\n" +
      "An advocate argues it, a skeptic prosecutes it, the judge rules on live market evidence — " +
      "the verdict is hash-committed *before* execution, so the record can't be doctored.\n\n" +
      "/portfolio — positions & PnL",
    { parse_mode: "Markdown" }
  )
);

bot.command("portfolio", async (ctx) => {
  const p = await portfolio();
  const lines = p.positions
    .slice(0, 8)
    .map(
      (x) =>
        `${x.status === "open" ? "🟢" : "⚪️"} ${x.side.toUpperCase()} ${x.symbol} ${fmtUsd(x.sizeUsd)} @ ${x.entryPrice.toLocaleString()} → ${x.status === "open" ? fmtUsd(x.unrealizedPnl) + " uPnL" : fmtUsd(x.realizedPnl ?? 0) + " realized"}`
    )
    .join("\n");
  await ctx.reply(
    `📊 Equity ${fmtUsd(p.equity)} (start ${fmtUsd(p.equityStart)})\n` +
      `Realized ${fmtUsd(p.realizedPnl)} · Unrealized ${fmtUsd(p.unrealizedPnl)}\n\n${lines || "No positions yet."}`
  );
});

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith("/")) return;

  await ctx.reply("👁 The tribunal convenes…");
  const say: string[] = [];
  const emit = async (e: RunEvent) => {
    if (e.type === "tool") say.push(`🔧 ${e.name}: ${e.detail}`);
    if (e.type === "say") {
      const icon = e.role === "advocate" ? "🟢" : e.role === "skeptic" ? "🔴" : "⚖️";
      await ctx.reply(`${icon} *${e.role.toUpperCase()}*\n${e.text}`, {
        parse_mode: "Markdown",
      });
    }
    if (e.type === "error") await ctx.reply(`⚠️ ${e.message}`);
  };

  const signal = await runAgent(text, (e) => void emit(e), 250);
  if (!signal) return;

  if (signal.verdict.ruling === "REJECT") {
    await ctx.reply(
      `🚫 Motion denied (confidence ${signal.verdict.confidence}/100).\n` +
        `Commit: \`${signal.commitHash.slice(0, 18)}…\` — the rejection is on the record too.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  const kb = new InlineKeyboard()
    .text("✅ Execute", `exec:${signal.id}`)
    .text("❌ Dismiss", `dismiss:${signal.id}`);
  await ctx.reply(
    `⚖️ *${signal.verdict.ruling}* — ${signal.intent.side.toUpperCase()} ${signal.intent.symbol} ${fmtUsd(signal.verdict.sizeUsd)}\n` +
      `Confidence ${signal.verdict.confidence}/100\n` +
      `Commit: \`${signal.commitHash.slice(0, 18)}…\` (sealed before execution)`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
});

bot.callbackQuery(/^exec:(.+)$/, async (ctx) => {
  const id = ctx.match[1];
  const signal = getSignal(id);
  if (!signal || signal.status !== "pending") {
    await ctx.answerCallbackQuery({ text: "Already settled." });
    return;
  }
  const position = await openPosition(signal);
  signal.status = "executed";
  signal.revealedAt = Date.now();
  saveSignal(signal);
  await ctx.answerCallbackQuery({ text: "Executed." });
  await ctx.reply(
    `✅ Filled: ${position.side.toUpperCase()} ${position.symbol} ${fmtUsd(position.sizeUsd)} @ ${position.entryPrice.toLocaleString()}\n` +
      `🧾 Receipt: \`${position.receipt.slice(0, 18)}…\`\n/portfolio to track PnL`,
    { parse_mode: "Markdown" }
  );
});

bot.callbackQuery(/^dismiss:(.+)$/, async (ctx) => {
  const id = ctx.match[1];
  const signal = getSignal(id);
  if (signal && signal.status === "pending") {
    signal.status = "cancelled";
    saveSignal(signal);
  }
  await ctx.answerCallbackQuery({ text: "Dismissed." });
  await ctx.reply("🗂 Case dismissed. The commit stays on the record.");
});

console.log("⚖️ Themis bot online.");
bot.start();
