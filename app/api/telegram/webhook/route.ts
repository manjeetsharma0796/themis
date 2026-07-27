// Telegram calls this on every message / button tap. We authenticate with the
// secret token set at registration, then hand the update to the shared tribunal.
import { NextResponse, after } from "next/server";
import { readTelegram } from "@/lib/telegram/store";
import { handleTelegramUpdate } from "@/lib/telegram/handle";

export const runtime = "nodejs";
export const maxDuration = 60; // background copilot work runs after the 200

export async function POST(req: Request) {
  const rec = await readTelegram();
  if (!rec) return NextResponse.json({ ok: true }); // not connected — ignore quietly

  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== rec.secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 401 });
  }

  const update = await req.json().catch(() => null);
  if (update) {
    // ACK Telegram IMMEDIATELY, then run the (possibly slow) copilot in the
    // background — otherwise the LLM turn outlasts Telegram's read timeout and
    // it retries forever, jamming the queue.
    after(async () => {
      try {
        await handleTelegramUpdate(update, rec.token);
      } catch (e) {
        console.error("telegram webhook handler failed", e);
      }
    });
  }
  return NextResponse.json({ ok: true }); // instant 200 — no more read timeouts
}
