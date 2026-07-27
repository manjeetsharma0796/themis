"use client";
// Paste a bot token → Themis validates it and registers a Telegram webhook, so
// the copilot answers from your pocket with no separate process to run. The token
// is stored server-side only; this card just shows connected state.
import { useEffect, useState } from "react";

export function TelegramConnect({ title = "Remote control" }: { title?: string }) {
  const [token, setToken] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/telegram/status")
      .then((r) => r.json())
      .then((j) => {
        if (j.connected) setUsername(j.username);
      })
      .catch(() => {});
  }, []);

  const connect = async () => {
    if (!token.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/telegram/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const j = await r.json();
      if (j.ok) {
        setUsername(j.username);
        setToken("");
      } else {
        setErr(j.error ?? "Could not connect.");
      }
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setErr(null);
    try {
      await fetch("/api/telegram/setup", { method: "DELETE" });
      setUsername(null);
    } catch {
      setErr("Could not disconnect.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="keyline-soft rounded bg-surface p-5">
      <h3 className="font-serif text-lg font-medium">{title}</h3>

      {username ? (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-up" />
            <span className="text-parchment">@{username}</span>
            <span className="text-faint">· connected</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={`https://t.me/${username}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11px] text-brass underline"
            >
              open in Telegram ↗
            </a>
            <button
              onClick={disconnect}
              disabled={busy}
              className="font-mono text-[11px] text-muted transition-colors hover:text-down disabled:opacity-40"
            >
              {busy ? "…" : "disconnect"}
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted">
            Message your bot an intent like{" "}
            <code className="text-brass">long BTC $200</code> — the tribunal replies with a verdict and
            Execute / Dismiss buttons.
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-muted">
            <li>
              In Telegram, open <code className="text-brass">@BotFather</code> →{" "}
              <code className="text-brass">/newbot</code>, and copy the token it gives you.
            </li>
            <li>Paste it below and connect — Themis registers the webhook for you.</li>
          </ol>
          <div className="flex gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && connect()}
              placeholder="123456789:AA…  bot token"
              className="min-w-0 flex-1 rounded bg-ink px-3 py-2 font-mono text-xs text-parchment outline-none ring-1 ring-transparent focus:ring-hairline"
            />
            <button
              onClick={connect}
              disabled={busy || !token.trim()}
              className="shrink-0 rounded bg-brass px-4 font-mono text-[11px] font-semibold text-ink transition-transform hover:-translate-y-px disabled:opacity-40"
            >
              {busy ? "connecting…" : "Connect"}
            </button>
          </div>
          {err && <p className="font-mono text-[10px] text-down">{err}</p>}
          <p className="text-[10px] leading-relaxed text-faint">
            Runs serverless on this deployment — no need to run <code>npm run bot</code>. Connect from the
            live HTTPS site (Telegram can&apos;t reach localhost).
          </p>
        </div>
      )}
    </section>
  );
}
