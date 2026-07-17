"use client";
// The docket — a live court record of everything the agent does:
// steps, tool calls, tribunal arguments, seals, fills.
import { useEffect, useRef } from "react";
import type { DocketEntry } from "@/components/console/useAgentRun";

const ROLE_STYLE: Record<string, { rubric: string; cls: string }> = {
  advocate: { rubric: "ADVOCATE", cls: "text-up" },
  skeptic: { rubric: "SKEPTIC", cls: "text-down" },
  judge: { rubric: "THE COURT", cls: "text-brass" },
};

function Line({ e }: { e: DocketEntry }) {
  const time = new Date(e.at).toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <li className="docket-in relative pl-5">
      <span className="absolute left-0 top-[7px] h-1.5 w-1.5 rounded-full bg-brass-deep" />
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 font-mono text-[10px] text-faint">{time}</span>
        <div className="min-w-0">
          {e.type === "step" && (
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brass">
              {e.label}
            </p>
          )}
          {e.type === "tool" && (
            <p className="font-mono text-xs text-muted">
              <span className="text-parchment">{e.name}</span>
              <span className="text-faint"> · </span>
              {e.detail}
            </p>
          )}
          {e.type === "say" && (
            <p className="text-sm leading-relaxed">
              <span
                className={`mr-2 font-mono text-[10px] tracking-widest ${ROLE_STYLE[e.role].cls}`}
              >
                {ROLE_STYLE[e.role].rubric}
              </span>
              <span className={e.role === "judge" ? "font-serif text-base" : "text-muted"}>
                {e.text}
              </span>
            </p>
          )}
          {e.type === "verdict" && (
            <p className="font-mono text-xs text-muted">
              ruling <span className="text-brass">{e.verdict.ruling}</span> · confidence{" "}
              {e.verdict.confidence}/100 · size ${e.verdict.sizeUsd}
            </p>
          )}
          {e.type === "commit" && (
            <p className="break-all font-mono text-xs">
              <span className="text-brass">⬡ sealed</span>{" "}
              <span className="text-faint">{e.hash}</span>
            </p>
          )}
          {e.type === "proposal" && (
            <p className="font-mono text-xs text-muted">
              proposal delivered to counsel — awaiting instruction
            </p>
          )}
          {e.type === "error" && (
            <p className="font-mono text-xs text-down">⚠ {e.message}</p>
          )}
        </div>
      </div>
    </li>
  );
}

export function Docket({ entries, running }: { entries: DocketEntry[]; running: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [entries]);

  return (
    <section className="keyline-soft flex h-full min-h-0 flex-col rounded bg-surface">
      <header className="flex items-baseline justify-between border-b border-hairline-soft px-4 py-3">
        <div>
          <h2 className="font-serif text-lg">The docket</h2>
          <p className="font-mono text-[10px] uppercase tracking-widest text-faint">
            live record of proceedings
          </p>
        </div>
        {running && (
          <span className="font-mono text-[10px] uppercase tracking-widest text-brass">
            ● in session
          </span>
        )}
      </header>
      <div ref={ref} className="min-h-0 flex-1 overflow-y-auto p-4">
        {entries.length === 0 ? (
          <p className="mt-6 text-center font-mono text-xs text-faint">
            no proceedings yet — the record begins with your first motion
          </p>
        ) : (
          <ul className="space-y-3 border-l border-hairline-soft pl-1">
            {entries.map((e) => (
              <Line key={e.key} e={e} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
