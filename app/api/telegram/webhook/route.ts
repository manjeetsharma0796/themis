// Telegram calls this on every message / button tap. We authenticate with the
// secret token set at registration, then hand the update to the shared tribunal.
import { NextResponse } from "next/server";
import { readTelegram } from "@/lib/telegram/store";
import { handleTelegramUpdate } from "@/lib/telegram/handle";

export const runtime = "nodejs";
export const maxDuration = 60; // the copilot may call several tools before replying

export async function POST(req: Request) {
  const rec = await readTelegram();
  if (!rec) return NextResponse.json({ ok: true }); // not connected — ignore quietly

  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== rec.secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 401 });
  }

  const update = await req.json().catch(() => null);
  if (update) {
    try {
      await handleTelegramUpdate(update, rec.token);
    } catch (e) {
      console.error("telegram webhook handler failed", e);
    }
  }
  // Always 200 — a non-2xx makes Telegram retry the same update.
  return NextResponse.json({ ok: true });
}
