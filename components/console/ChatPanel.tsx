"use client";
// The motion box — where intents are stated and verdicts land as ruling cards.
import { useEffect, useRef, useState } from "react";
import type { Signal } from "@/lib/types";
import type { ChatMsg } from "@/components/console/useAgentRun";

const EXAMPLES = ["long BTC with $200", "short SOL 150", "long MNT $80"];

function RulingCard({
  signal,
  receipt,
  onDecide,
}: {
  signal: Signal;
  receipt?: string;
  onDecide: (id: string, d: "confirm" | "cancel") => void;
}) {
  const v = signal.verdict;
  const tone =
    v.ruling === "APPROVE" ? "text-up" : v.ruling === "REVISE" ? "text-brass" : "text-down";
  return (
    <div className="keyline rounded bg-raised p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] name text-muted">
            ruling · case {signal.id.slice(4, 10)}
          </p>
          <p className="mt-2 font-serif text-2xl">
            {signal.intent.side === "long" ? "Long" : "Short"} {signal.intent.symbol}
            <span className="text-muted"> · ${v.sizeUsd}</span>
          </p>
        </div>
        <span className={`stamp font-mono text-sm ${tone}`}>{v.ruling}</span>
      </div>

      {/* confidence meter */}
      <div className="mt-4">
        <div className="flex justify-between font-mono text-[10px] text-muted">
          <span>confidence</span>
          <span>{v.confidence}/100</span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded bg-ink">
          <div
            className={`h-full ${v.ruling === "REJECT" ? "bg-down" : "bg-brass"}`}
            style={{ width: `${v.confidence}%` }}
          />
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted">{v.rationale}</p>
      <p className="mt-3 break-all font-mono text-[10px] text-faint">
        sealed {new Date(signal.committedAt).toLocaleTimeString()} ·{" "}
        <span className="text-brass-deep">{signal.commitHash.slice(0, 22)}…</span>
      </p>

      {signal.status === "pending" && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onDecide(signal.id, "confirm")}
            className="flex-1 rounded bg-brass px-3 py-2 font-mono text-xs font-semibold text-ink transition-transform hover:-translate-y-px"
          >
            ✓ Execute
          </button>
          <button
            onClick={() => onDecide(signal.id, "cancel")}
            className="keyline-soft flex-1 rounded px-3 py-2 font-mono text-xs text-muted transition-colors hover:text-parchment"
          >
            ✕ Dismiss
          </button>
        </div>
      )}
      {signal.status === "executed" && (
        <p className="mt-4 font-mono text-xs text-up">
          ✓ executed{receipt ? ` · receipt ${receipt.slice(0, 14)}…` : ""}
        </p>
      )}
      {signal.status === "cancelled" && (
        <p className="mt-4 font-mono text-xs text-faint">✕ dismissed — commit retained</p>
      )}
      {signal.status === "rejected" && (
        <p className="mt-4 font-mono text-xs text-down">
          motion denied — no execution path
        </p>
      )}
    </div>
  );
}

export function ChatPanel({
  messages,
  running,
  onSend,
  onDecide,
}: {
  messages: ChatMsg[];
  running: boolean;
  onSend: (text: string) => void;
  onDecide: (id: string, d: "confirm" | "cancel") => void;
}) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, running]);

  const submit = () => {
    if (!text.trim() || running) return;
    onSend(text);
    setText("");
  };

  return (
    <section className="keyline-soft flex h-full min-h-0 flex-col rounded bg-surface">
      <header className="border-b border-hairline-soft px-4 py-3">
        <h2 className="font-serif text-lg">The motion</h2>
        <p className="font-mono text-[10px] uppercase tracking-widest text-faint">
          state your intent · the court convenes
        </p>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="mt-8 text-center">
            <p className="font-serif text-xl text-muted">The docket is empty.</p>
            <p className="mt-2 text-sm text-faint">Bring a motion:</p>
            <div className="mt-4 flex flex-col items-center gap-2">
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  onClick={() => onSend(e)}
                  className="keyline-soft rounded px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-hairline hover:text-brass"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] rounded rounded-br-none bg-raised px-3 py-2 text-sm">
                {m.text}
              </p>
            </div>
          ) : m.signal ? (
            <div key={m.id} className="docket-in">
              <RulingCard signal={m.signal} receipt={m.position?.receipt} onDecide={onDecide} />
            </div>
          ) : (
            <div key={m.id} className="flex">
              <p className="max-w-[85%] rounded rounded-bl-none border border-hairline-soft px-3 py-2 text-sm text-muted">
                {m.text}
              </p>
            </div>
          )
        )}

        {running && (
          <p className="caret font-mono text-xs text-muted">the tribunal deliberates</p>
        )}
      </div>

      <footer className="border-t border-hairline-soft p-3">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="long BTC with $200…"
            disabled={running}
            className="min-w-0 flex-1 rounded bg-ink px-3 py-2.5 font-mono text-sm outline-none ring-1 ring-transparent transition-shadow placeholder:text-faint focus:ring-hairline disabled:opacity-50"
          />
          <button
            onClick={submit}
            disabled={running || !text.trim()}
            className="rounded bg-brass px-4 font-mono text-sm font-semibold text-ink transition-transform hover:-translate-y-px disabled:opacity-40"
          >
            file →
          </button>
        </div>
      </footer>
    </section>
  );
}
