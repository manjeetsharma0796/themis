// Where the pasted bot token lives — server-side only (Redis when configured,
// else the local JSON store). Never returned to the browser; the webhook route
// reads it to authenticate updates and reply.
import { readJson, writeJson } from "@/lib/store";

export type TelegramRecord = {
  token: string;
  username: string;
  secret: string;
  setAt: number;
};

export const readTelegram = () => readJson<TelegramRecord | null>("telegram", null);
export const writeTelegram = (rec: TelegramRecord) => writeJson("telegram", rec);
export const clearTelegram = () => writeJson<TelegramRecord | null>("telegram", null);
