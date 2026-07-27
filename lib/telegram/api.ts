// Thin Telegram Bot API helpers (HTTP). Used by the webhook flow so the bot runs
// serverless (no long-running `npm run bot` process needed on the deployed app).
type Json = Record<string, unknown>;

const base = (token: string) => `https://api.telegram.org/bot${token}`;

async function call(token: string, method: string, body?: Json): Promise<Json> {
  try {
    const r = await fetch(`${base(token)}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    return (await r.json()) as Json;
  } catch (e) {
    return { ok: false, description: e instanceof Error ? e.message : "network error" };
  }
}

export const getMe = (token: string) => call(token, "getMe");

export const sendMessage = (
  token: string,
  chatId: number | string,
  text: string,
  replyMarkup?: Json
) => call(token, "sendMessage", { chat_id: chatId, text, reply_markup: replyMarkup, parse_mode: "Markdown" });

export const answerCallbackQuery = (token: string, id: string, text?: string) =>
  call(token, "answerCallbackQuery", { callback_query_id: id, text });

/** "typing" bubble while the copilot thinks — lasts ~5s, so re-send for long runs. */
export const sendChatAction = (token: string, chatId: number | string, action = "typing") =>
  call(token, "sendChatAction", { chat_id: chatId, action });

export const setWebhook = (token: string, url: string, secret: string) =>
  call(token, "setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
  });

/** The command list shown in Telegram's "/" menu. Registered at connect time. */
export const BOT_COMMANDS = [
  { command: "start", description: "What Themis can do" },
  { command: "portfolio", description: "Positions & PnL" },
  { command: "model", description: "Pick the AI model" },
  { command: "clear", description: "Reset our conversation" },
  { command: "help", description: "How to use Themis" },
];

export const setMyCommands = (
  token: string,
  commands: { command: string; description: string }[] = BOT_COMMANDS
) => call(token, "setMyCommands", { commands });

export const deleteWebhook = (token: string) => call(token, "deleteWebhook", {});
