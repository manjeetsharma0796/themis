"use client";
// Client orchestration for one agent session: streams RunEvents over SSE,
// splits them into chat messages + docket entries, handles execute/cancel.
import { useCallback, useRef, useState } from "react";
import type { Position, RunEvent, Signal } from "@/lib/types";

export type ChatMsg = {
  id: string;
  role: "user" | "agent";
  text?: string;
  signal?: Signal;
  position?: Position;
};

export type DocketEntry = RunEvent & { at: number; key: string };

let n = 0;
const nid = () => `m${Date.now().toString(36)}_${n++}`;

export function useAgentRun() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [docket, setDocket] = useState<DocketEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [symbol, setSymbol] = useState("BTC");
  const [portfolioVersion, setPortfolioVersion] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const pushDocket = useCallback((e: RunEvent) => {
    setDocket((d) => [...d, { ...e, at: Date.now(), key: nid() }]);
  }, []);

  const send = useCallback(
    async (text: string) => {
      if (running || !text.trim()) return;
      setRunning(true);
      setMessages((m) => [...m, { id: nid(), role: "user", text }]);

      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch("/api/agent/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) throw new Error(`run failed (${res.status})`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const data = line.replace(/^data: /, "").trim();
            if (!data || data === "[DONE]") continue;
            const ev = JSON.parse(data) as RunEvent;
            pushDocket(ev);
            if (ev.type === "proposal") {
              setSymbol(ev.signal.intent.symbol);
              setMessages((m) => [
                ...m,
                { id: nid(), role: "agent", signal: ev.signal },
              ]);
            }
            if (ev.type === "error") {
              setMessages((m) => [...m, { id: nid(), role: "agent", text: ev.message }]);
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "stream failed";
        setMessages((m) => [...m, { id: nid(), role: "agent", text: `⚠ ${msg}` }]);
      } finally {
        setRunning(false);
        abortRef.current = null;
      }
    },
    [running, pushDocket]
  );

  const decide = useCallback(
    async (signalId: string, decision: "confirm" | "cancel") => {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: signalId, decision }),
      });
      const json = (await res.json()) as { signal?: Signal; position?: Position; error?: string };
      if (!res.ok || !json.signal) {
        pushDocket({ type: "error", message: json.error ?? "execution failed" });
        return;
      }
      setMessages((m) =>
        m.map((msg) =>
          msg.signal?.id === signalId
            ? { ...msg, signal: json.signal, position: json.position }
            : msg
        )
      );
      pushDocket(
        decision === "confirm"
          ? {
              type: "tool",
              name: "execute",
              detail: `filled ${json.position?.side.toUpperCase()} ${json.position?.symbol} @ ${json.position?.entryPrice.toLocaleString()} · receipt ${json.position?.receipt.slice(0, 14)}…`,
            }
          : { type: "step", label: "Case dismissed — commit stays on record" }
      );
      setPortfolioVersion((v) => v + 1);
    },
    [pushDocket]
  );

  return { messages, docket, running, symbol, portfolioVersion, send, decide };
}
