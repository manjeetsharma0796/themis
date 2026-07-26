"use client";
// Client orchestration for the copilot chat: streams /api/chat SSE into a single
// ordered transcript of items (user text, assistant text, inline tool calls,
// inline charts, ruling cards) + suggestion chips, and handles execute/cancel.
import { useCallback, useRef, useState } from "react";
import type { Position, Signal } from "@/lib/types";
import { configForRequest } from "@/lib/config";

export type ChatItem =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "assistant"; text: string; error?: boolean }
  | { id: string; kind: "tool"; name: string; detail: string }
  | { id: string; kind: "chart"; symbol: string; interval: string }
  | { id: string; kind: "proposal"; signal: Signal; position?: Position };

type ChatEvent =
  | { type: "provider"; provider: string }
  | { type: "say"; text: string }
  | { type: "tool"; name: string; detail: string }
  | { type: "chart"; symbol: string; interval: string }
  | { type: "proposal"; signal: Signal }
  | { type: "chips"; items: string[] }
  | { type: "error"; message: string };

let n = 0;
const nid = () => `c${Date.now().toString(36)}_${n++}`;

export function useCopilot() {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [symbol, setSymbol] = useState("BTC");
  const [portfolioVersion, setPortfolioVersion] = useState(0);
  const itemsRef = useRef<ChatItem[]>([]);
  const runningRef = useRef(false);

  const push = (item: ChatItem) => {
    itemsRef.current = [...itemsRef.current, item];
    setItems(itemsRef.current);
  };

  const send = useCallback(async (text: string) => {
    if (runningRef.current || !text.trim()) return;
    runningRef.current = true;
    setRunning(true);
    setChips([]);
    push({ id: nid(), kind: "user", text });

    const history = itemsRef.current
      .filter((i) => i.kind === "user" || (i.kind === "assistant" && !i.error))
      .slice(-12)
      .map((i) => ({ role: i.kind, content: (i as { text: string }).text }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, history, config: configForRequest() }),
      });
      if (!res.ok || !res.body) throw new Error(`chat failed (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const chunks = buf.split("\n\n");
        buf = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const data = chunk.replace(/^data: /, "").trim();
          if (!data || data === "[DONE]") continue;
          const ev = JSON.parse(data) as ChatEvent;
          switch (ev.type) {
            case "provider":
              setProvider(ev.provider);
              break;
            case "say":
              push({ id: nid(), kind: "assistant", text: ev.text });
              break;
            case "tool":
              push({ id: nid(), kind: "tool", name: ev.name, detail: ev.detail });
              break;
            case "chart":
              setSymbol(ev.symbol);
              push({ id: nid(), kind: "chart", symbol: ev.symbol, interval: ev.interval });
              break;
            case "proposal":
              setSymbol(ev.signal.intent.symbol);
              push({ id: nid(), kind: "proposal", signal: ev.signal });
              break;
            case "chips":
              setChips(ev.items);
              break;
            case "error":
              push({ id: nid(), kind: "assistant", text: `⚠ ${ev.message}`, error: true });
              break;
          }
        }
      }
    } catch (err) {
      push({
        id: nid(),
        kind: "assistant",
        text: `⚠ ${err instanceof Error ? err.message : "stream failed"}`,
        error: true,
      });
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, []);

  const decide = useCallback(async (signalId: string, decision: "confirm" | "cancel") => {
    const res = await fetch("/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: signalId, decision }),
    });
    const json = (await res.json()) as { signal?: Signal; position?: Position; error?: string };
    if (!res.ok || !json.signal) return;
    itemsRef.current = itemsRef.current.map((i) =>
      i.kind === "proposal" && i.signal.id === signalId
        ? { ...i, signal: json.signal!, position: json.position }
        : i
    );
    setItems(itemsRef.current);
    setPortfolioVersion((v) => v + 1);
  }, []);

  return { items, chips, running, provider, symbol, portfolioVersion, send, decide };
}
