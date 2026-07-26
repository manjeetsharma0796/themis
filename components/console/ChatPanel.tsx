"use client";
// The copilot transcript — chat with inline tool calls, inline charts, ruling
// cards, and tappable suggestion chips.
import { useEffect, useRef, useState } from "react";
import type { Signal } from "@/lib/types";
import type { ChatItem } from "@/components/console/useCopilot";
import { InlineChart } from "@/components/console/InlineChart";

const EXAMPLES = ["What can I buy with $399?", "Show me the SOL chart", "I want to invest in BTC"];

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
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
            ruling · case {signal.id.slice(4, 10)}
          </p>
          <p className="mt-2 font-serif text-2xl font-medium">
            {signal.intent.side === "long" ? "Long" : "Short"} {signal.intent.symbol}
            <span className="text-muted"> · ${v.sizeUsd}</span>
          </p>
        </div>
        <span className={`stamp font-mono text-sm ${tone}`}>{v.ruling}</span>
      </div>

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

      <p className="mt-3 text-sm leading-relaxed text-parchment">{v.rationale}</p>
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
        <p className="mt-4 font-mono text-xs text-down">motion denied — no execution path</p>
      )}
    </div>
  );
}

export function ChatPanel({
  items,
  chips,
  running,
  provider,
  activeModel,
  onSend,
  onCommand,
  onSelectModel,
  onDecide,
}: {
  items: ChatItem[];
  chips: string[];
  running: boolean;
  provider: string | null;
  activeModel: string;
  onSend: (text: string) => void;
  onCommand: (text: string) => void;
  onSelectModel: (provider: string, id: string) => void;
  onDecide: (id: string, d: "confirm" | "cancel") => void;
}) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [items, running, chips]);

  const submit = () => {
    const t = text.trim();
    if (!t || running) return;
    setText("");
    if (t.startsWith("/")) onCommand(t);
    else onSend(t);
  };

  return (
    <section className="keyline-soft flex h-full min-h-0 flex-col rounded bg-surface">
      <header className="flex items-baseline justify-between border-b border-hairline px-4 py-3">
        <div>
          <h2 className="font-serif text-lg font-medium">Themis</h2>
          <p className="font-mono text-[10px] uppercase tracking-widest text-faint">
            your trading copilot
          </p>
        </div>
        {(activeModel || provider) && (
          <span className="max-w-[48%] truncate font-mono text-[9px] uppercase tracking-widest text-faint">
            {activeModel || `via ${provider}`}
          </span>
        )}
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {items.length === 0 && (
          <div className="mt-8 text-center">
            <p className="font-serif text-xl text-parchment">Ask the court.</p>
            <p className="mt-2 text-sm text-muted">
              Try a prompt, or <span className="text-brass">/model</span> to pick a model:
            </p>
            <div className="mt-4 flex flex-col items-center gap-2">
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  onClick={() => onSend(e)}
                  className="keyline-soft rounded-full px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-hairline hover:text-brass"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        {items.map((it) => {
          if (it.kind === "user")
            return (
              <div key={it.id} className="flex justify-end">
                <div
                  className="max-w-[85%] rounded rounded-br-none px-3 py-2 text-sm text-parchment"
                  style={{ background: "rgba(217,164,65,0.14)" }}
                >
                  {it.text}
                </div>
              </div>
            );
          if (it.kind === "assistant")
            return (
              <div key={it.id} className="flex">
                <div
                  className={`max-w-[88%] whitespace-pre-wrap rounded rounded-bl-none border px-3 py-2 text-sm leading-relaxed ${
                    it.error ? "border-down/40 text-down" : "border-hairline-soft text-parchment"
                  }`}
                >
                  {it.text}
                </div>
              </div>
            );
          if (it.kind === "tool")
            return (
              <div key={it.id} className="flex items-center gap-2 pl-1 font-mono text-[11px]">
                <span className="text-brass">⟩ {it.name}</span>
                {it.detail && <span className="truncate text-faint">· {it.detail}</span>}
              </div>
            );
          if (it.kind === "chart")
            return (
              <div key={it.id} className="docket-in">
                <InlineChart symbol={it.symbol} interval={it.interval} />
              </div>
            );
          if (it.kind === "models")
            return (
              <div key={it.id} className="docket-in keyline rounded bg-raised p-3">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  select a model · {it.options.length}
                </p>
                <div className="max-h-60 space-y-1 overflow-y-auto">
                  {it.options.map((o) => (
                    <button
                      key={`${o.provider}/${o.id}`}
                      onClick={() => onSelectModel(o.provider, o.id)}
                      className="group flex w-full items-baseline justify-between gap-2 rounded px-2 py-1.5 text-left font-mono text-[11px] text-parchment transition-colors hover:bg-brass hover:text-ink"
                    >
                      <span className="truncate">{o.id}</span>
                      <span className="shrink-0 text-[9px] uppercase tracking-widest text-faint group-hover:text-ink">
                        {o.provider}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          // proposal
          return (
            <div key={it.id} className="docket-in">
              <RulingCard signal={it.signal} receipt={it.position?.receipt} onDecide={onDecide} />
            </div>
          );
        })}

        {running && (
          <p className="caret font-mono text-xs text-muted">Themis is thinking</p>
        )}

        {chips.length > 0 && !running && (
          <div className="flex flex-wrap gap-2 pt-1">
            {chips.map((c) => (
              <button
                key={c}
                onClick={() => onSend(c)}
                className="keyline-soft rounded-full px-3 py-1.5 font-mono text-[11px] text-muted transition-colors hover:border-hairline hover:text-brass"
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <footer className="border-t border-hairline-soft p-3">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Ask Themis… e.g. what can I buy with $500?"
            disabled={running}
            className="min-w-0 flex-1 rounded bg-ink px-3 py-2.5 font-mono text-sm text-parchment outline-none ring-1 ring-transparent transition-shadow placeholder:text-faint focus:ring-hairline disabled:opacity-50"
          />
          <button
            onClick={submit}
            disabled={running || !text.trim()}
            className="rounded bg-brass px-4 font-mono text-sm font-semibold text-ink transition-transform hover:-translate-y-px disabled:opacity-40"
          >
            send →
          </button>
        </div>
      </footer>
    </section>
  );
}
