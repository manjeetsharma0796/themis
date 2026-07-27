// Lets the UI show connected state on reload — exposes only the bot username,
// never the token or secret.
import { NextResponse } from "next/server";
import { readTelegram } from "@/lib/telegram/store";

export const runtime = "nodejs";

export async function GET() {
  const rec = await readTelegram();
  return NextResponse.json({ connected: !!rec, username: rec?.username ?? null });
}
