"use client";
// Client orchestration for the copilot chat: streams /api/chat SSE into a single
// ordered transcript (user/assistant text, inline tool calls, inline charts,
// ruling cards, model picker) + suggestion chips. Also handles slash commands
// (/model, /clear, /help) terminal-agent style, and execute/cancel.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Position, Signal } from "@/lib/types";
import { configForRequest, loadConfig, saveConfig } from "@/lib/config";
import { getWalletAddress } from "@/lib/wallet/wallet";

export type ChatItem =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "assistant"; text: string; error?: boolean }
  | { id: string; kind: "tool"; name: string; detail: string }
  | { id: string; kind: "toolresult"; name: string; output: string }
  | { id: string; kind: "chart"; symbol: string; interval: string }
  | {
      id: string;
      kind: "proposal";
      signal: Signal;
      position?: Position;
      anchor?: "anchoring" | "anchored" | "skipped";
    }
  | { id: string; kind: "models"; options: { provider: string; id: string }[] };

type ChatEvent =
  | { type: "provider"; provider: string }
  | { type: "say"; text: string }
  | { type: "tool"; name: string; detail: string }
  | { type: "chart"; symbol: string; interval: string }
  | { type: "proposal"; signal: Signal }
  | { type: "chips"; items: string[] }
  | { type: "token"; text: string }
  | { type: "endmsg" }
  | { type: "toolresult"; name: string; output: string }
  | { type: "error"; message: string };

let n = 0;
const nid = () => `c${Date.now().toString(36)}_${n++}`;

export function useCopilot() {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [symbol, setSymbol] = useState("BTC");
  const [activeModel, setActiveModel] = useState<string>("");
  const [portfolioVersion, setPortfolioVersion] = useState(0);
  const itemsRef = useRef<ChatItem[]>([]);
  const runningRef = useRef(false);
  const activeIdRef = useRef<string | null>(null);

  const push = (item: ChatItem) => {
    itemsRef.current = [...itemsRef.current, item];
    setItems(itemsRef.current);
  };

  // Streaming: append a token to the active assistant bubble (created on first token).
  const appendToken = (delta: string) => {
    if (activeIdRef.current) {
      itemsRef.current = itemsRef.current.map((i) =>
        i.id === activeIdRef.current && i.kind === "assistant" ? { ...i, text: i.text + delta } : i
      );
    } else {
      const id = nid();
      activeIdRef.current = id;
      itemsRef.current = [...itemsRef.current, { id, kind: "assistant", text: delta }];
    }
    setItems(itemsRef.current);
  };
  const sealActive = () => {
    activeIdRef.current = null;
  };

  useEffect(() => {
    const c = loadConfig();
    const first = Object.keys(c.keys ?? {}).find((k) => c.keys[k]);
    if (first) setActiveModel(`${first}/${c.models?.[first] || "default"}`);
  }, []);

  const send = useCallback(async (text: string) => {
    if (runningRef.current || !text.trim()) return;
    runningRef.current = true;
    setRunning(true);
    setChips([]);
    activeIdRef.current = null;
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
          if (ev.type === "token") {
            appendToken(ev.text);
            continue;
          }
          sealActive();
          switch (ev.type) {
            case "endmsg":
              break;
            case "provider":
              setProvider(ev.provider);
              break;
            case "say":
              push({ id: nid(), kind: "assistant", text: ev.text });
              break;
            case "tool":
              push({ id: nid(), kind: "tool", name: ev.name, detail: ev.detail });
              break;
            case "toolresult":
              push({ id: nid(), kind: "toolresult", name: ev.name, output: ev.output });
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
              setChips((ev.items ?? []).filter((x): x is string => typeof x === "string" && x.length > 0));
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
      sealActive();
      runningRef.current = false;
      setRunning(false);
    }
  }, []);

  const bumpLedger = useCallback(() => setPortfolioVersion((v) => v + 1), []);

  const selectModel = useCallback((prov: string, id: string) => {
    const c = loadConfig();
    saveConfig({ ...c, keys: c.keys ?? {}, models: { ...(c.models ?? {}), [prov]: id } });
    setActiveModel(`${prov}/${id}`);
    push({ id: nid(), kind: "assistant", text: `Active model → ${prov}/${id}. I'll use it from the next message.` });
  }, []);

  const command = useCallback(async (text: string) => {
    const cmd = text.trim().toLowerCase();
    push({ id: nid(), kind: "user", text: text.trim() });

    if (cmd === "/clear") {
      itemsRef.current = [];
      setItems([]);
      setChips([]);
      return;
    }
    if (cmd === "/help") {
      push({
        id: nid(),
        kind: "assistant",
        text: "**Commands**\n/model — pick a model (live list)\n/balance — agent wallet balance (X Layer)\n/wallet — show wallet address\n/fund — fund it via the faucet\n/clear — clear the chat\n/help — this\n\nOr just talk: “what can I buy with $500?”, “long BTC 200”, “show me the SOL chart”.",
      });
      return;
    }
    if (cmd === "/model" || cmd === "/models") {
      const c = loadConfig();
      const keyed = Object.keys(c.keys ?? {}).filter((k) => c.keys[k]);
      if (!keyed.length) {
        push({
          id: nid(),
          kind: "assistant",
          text: "No API key set yet — add one in Settings (⚙), then /model lists live models.",
        });
        return;
      }
      setRunning(true);
      try {
        const options: { provider: string; id: string }[] = [];
        for (const p of keyed) {
          try {
            const r = await fetch("/api/models", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ provider: p, key: c.keys[p] }),
            });
            const j = await r.json();
            if (j.models?.length) for (const m of j.models.slice(0, 60)) options.push({ provider: p, id: m.id });
          } catch {
            /* skip provider */
          }
        }
        if (!options.length) {
          push({ id: nid(), kind: "assistant", text: "Couldn't load models — check your key in Settings." });
        } else {
          push({ id: nid(), kind: "models", options });
        }
      } finally {
        setRunning(false);
      }
      return;
    }
    if (cmd === "/balance") {
      const addr = getWalletAddress();
      if (!addr) {
        push({ id: nid(), kind: "assistant", text: "No agent wallet yet — open **Settings** to create one." });
        return;
      }
      setRunning(true);
      try {
        const r = await fetch(`/api/wallet/balance?address=${addr}`);
        const j = await r.json();
        const bal = typeof j.balance === "string" ? Number(j.balance) : 0;
        push({
          id: nid(),
          kind: "assistant",
          text:
            `**Agent wallet** \`${addr.slice(0, 6)}…${addr.slice(-4)}\`\nBalance: **${bal.toFixed(4)} OKB** on X Layer testnet.` +
            (bal === 0 ? "\n\nEmpty — run `/fund` to top it up so the agent can anchor seals on-chain." : ""),
        });
      } catch {
        push({ id: nid(), kind: "assistant", text: "Couldn't reach the X Layer RPC — try again in a moment." });
      } finally {
        setRunning(false);
      }
      return;
    }
    if (cmd === "/wallet" || cmd === "/address") {
      const addr = getWalletAddress();
      push({
        id: nid(),
        kind: "assistant",
        text: addr
          ? `**Agent wallet** (X Layer testnet)\n\`${addr}\`\n\nBalance with \`/balance\`, top up with \`/fund\`.`
          : "No agent wallet yet — open **Settings** to create one.",
      });
      return;
    }
    if (cmd === "/fund") {
      const addr = getWalletAddress();
      push({
        id: nid(),
        kind: "assistant",
        text:
          "**Fund your agent wallet** with testnet OKB:\n\n" +
          "1. Open the [X Layer faucet](https://web3.okx.com/xlayer/faucet)\n" +
          `2. Paste your address:\n\`${addr ?? "(open Settings to create a wallet first)"}\`\n` +
          "3. Come back and run `/balance` to confirm.\n\n" +
          "The agent spends this OKB to anchor each sealed verdict on-chain.",
      });
      return;
    }
    push({
      id: nid(),
      kind: "assistant",
      text: `Unknown command "${text.trim()}". Try /model, /balance, /wallet, /fund, /clear, /help.`,
    });
  }, []);

  const decide = useCallback(async (signalId: string, decision: "confirm" | "cancel") => {
    const res = await fetch("/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: signalId, decision }),
    });
    const json = (await res.json()) as { signal?: Signal; position?: Position; error?: string };
    if (!res.ok || !json.signal) return;
    const sig = json.signal;
    const willAnchor = decision === "confirm" && sig.status === "executed";
    // Show "anchoring" the instant we execute; the server may already have anchored
    // (ANCHOR_PRIVATE_KEY), in which case the tx link is present immediately.
    const initialAnchor: "anchoring" | "anchored" | undefined = willAnchor
      ? sig.anchorTx
        ? "anchored"
        : "anchoring"
      : undefined;
    itemsRef.current = itemsRef.current.map((i) =>
      i.kind === "proposal" && i.signal.id === signalId
        ? { ...i, signal: sig, position: json.position, anchor: initialAnchor }
        : i
    );
    setItems(itemsRef.current);
    setPortfolioVersion((v) => v + 1);

    // Client-anchor with the persistent agent wallet only if the server didn't.
    if (willAnchor && !sig.anchorTx) {
      let done: { txHash: string; explorer: string } | null = null;
      try {
        const { anchorSealOnChain } = await import("@/lib/wallet/anchorClient");
        done = await anchorSealOnChain(sig.commitHash);
        if (done) {
          await fetch("/api/signals/anchor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: signalId, txHash: done.txHash, explorer: done.explorer }),
          });
        }
      } catch {
        done = null; // insufficient funds / RPC issue — surfaced as "skipped" below
      }
      itemsRef.current = itemsRef.current.map((i) =>
        i.kind === "proposal" && i.signal.id === signalId
          ? done
            ? {
                ...i,
                anchor: "anchored" as const,
                signal: { ...i.signal, anchorTx: done.txHash, anchorExplorer: done.explorer },
              }
            : { ...i, anchor: "skipped" as const }
          : i
      );
      setItems(itemsRef.current);
    }
  }, []);

  return {
    items,
    chips,
    running,
    provider,
    symbol,
    activeModel,
    portfolioVersion,
    send,
    command,
    selectModel,
    decide,
    bumpLedger,
  };
}
