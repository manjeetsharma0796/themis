// Model picker for the Telegram copilot. Lists the server's Mistral chat models
// and remembers a per-chat choice. (Server key is Mistral; the web console still
// does full BYOK across providers.)
import { readJson, writeJson } from "@/lib/store";

export const DEFAULT_MODEL = "ministral-8b-latest";

const CURATED = [
  "ministral-3b-latest",
  "ministral-8b-latest",
  "mistral-small-latest",
  "mistral-medium-latest",
  "mistral-large-latest",
  "open-mistral-nemo",
];

/** Live Mistral chat models (clean `-latest` aliases), falling back to a curated set. */
export async function listModels(): Promise<string[]> {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) return CURATED;
  try {
    const r = await fetch("https://api.mistral.ai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.ok) return CURATED;
    const j = (await r.json()) as { data?: { id?: string }[] };
    const ids = (j.data ?? [])
      .map((m) => m.id)
      .filter(
        (id): id is string =>
          typeof id === "string" && id.endsWith("latest") && !/embed|moderation|ocr/i.test(id)
      );
    const uniq = [...new Set(ids)].sort();
    return uniq.length ? uniq.slice(0, 16) : CURATED;
  } catch {
    return CURATED;
  }
}

const mkey = (chatId: number) => `tg_model_${chatId}`;
export const getChatModel = (chatId: number) => readJson<string | null>(mkey(chatId), null);
export const setChatModel = (chatId: number, id: string) => writeJson(mkey(chatId), id);
