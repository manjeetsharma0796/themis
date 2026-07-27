// Connect a Telegram bot by pasting its token: validate it, register a webhook
// pointing back at this deployment, and stash the token server-side. DELETE
// tears the connection down. Requires HTTPS (Telegram won't call localhost).
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getMe, setWebhook, deleteWebhook } from "@/lib/telegram/api";
import { readTelegram, writeTelegram, clearTelegram } from "@/lib/telegram/store";

export const runtime = "nodejs";

function originOf(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const token = body.token?.trim();
  if (!token) return NextResponse.json({ error: "Paste your bot token first." }, { status: 400 });

  const me = await getMe(token);
  if (!me.ok) {
    return NextResponse.json(
      { error: "That token was rejected by Telegram — copy it again from @BotFather." },
      { status: 400 }
    );
  }
  const username = (me.result as { username?: string })?.username ?? "bot";

  const origin = originOf(req);
  if (origin.startsWith("http://")) {
    return NextResponse.json(
      { error: "Telegram needs an HTTPS URL. Connect from the deployed site (not localhost)." },
      { status: 400 }
    );
  }

  const secret = randomUUID().replace(/-/g, "");
  const hook = await setWebhook(token, `${origin}/api/telegram/webhook`, secret);
  if (!hook.ok) {
    return NextResponse.json(
      { error: (hook.description as string) || "Telegram rejected the webhook registration." },
      { status: 400 }
    );
  }

  await writeTelegram({ token, username, secret, setAt: Date.now() });
  return NextResponse.json({ ok: true, username });
}

export async function DELETE() {
  const rec = await readTelegram();
  if (rec) {
    await deleteWebhook(rec.token);
    await clearTelegram();
  }
  return NextResponse.json({ ok: true });
}
