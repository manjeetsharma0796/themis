// Orchestrates one full agent run: parse → evidence → tribunal → verdict → commit.
// Emits RunEvents via a callback so both the SSE route and the Telegram bot reuse it.
import type { RunEvent, Signal } from "@/lib/types";
import { parseIntent, describeIntent } from "@/lib/agent/intent";
import { buildSnapshot } from "@/lib/market/indicators";
import { advocate, skeptic, judge, judgeLine } from "@/lib/agent/tribunal";
import { hashSignal } from "@/lib/agent/commit";
import { readJson, writeJson } from "@/lib/store";

export async function listSignals(): Promise<Signal[]> {
  return readJson<Signal[]>("signals", []);
}

export async function saveSignal(signal: Signal): Promise<void> {
  const all = await listSignals();
  const i = all.findIndex((s) => s.id === signal.id);
  if (i >= 0) all[i] = signal;
  else all.unshift(signal);
  await writeJson("signals", all);
}

export async function getSignal(id: string): Promise<Signal | null> {
  return (await listSignals()).find((s) => s.id === id) ?? null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runAgent(
  text: string,
  emit: (e: RunEvent) => void,
  pace = 450
): Promise<Signal | null> {
  emit({ type: "step", label: "Reading your intent" });
  const intent = parseIntent(text);
  await sleep(pace);

  if (intent.action !== "trade") {
    emit({
      type: "error",
      message:
        "I hear a question, not a motion. Try e.g. “long BTC with $200” — supported: BTC, ETH, SOL, SUI, MNT.",
    });
    return null;
  }
  emit({ type: "tool", name: "parse_intent", detail: describeIntent(intent) });
  await sleep(pace);

  emit({ type: "step", label: "Gathering evidence" });
  emit({ type: "tool", name: "get_ticker", detail: `${intent.symbol} · OKX live` });
  const snapshot = await buildSnapshot(intent.symbol);
  emit({
    type: "tool",
    name: "get_indicators",
    detail: `price ${snapshot.price.toLocaleString()} · RSI ${snapshot.rsi14.toFixed(0)} · trend ${snapshot.trend} · ATR ${snapshot.atrPct.toFixed(2)}%`,
  });
  await sleep(pace);

  emit({ type: "step", label: "The tribunal convenes" });
  const adv = advocate(intent, snapshot);
  emit({ type: "say", role: adv.role, text: adv.text });
  await sleep(pace * 1.6);

  const skp = skeptic(intent, snapshot);
  emit({ type: "say", role: skp.role, text: skp.text });
  await sleep(pace * 1.6);

  const verdict = judge(intent, snapshot);
  const jl = judgeLine(verdict);
  emit({ type: "say", role: jl.role, text: jl.text });
  emit({ type: "verdict", verdict });
  await sleep(pace);

  const id = `sig_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
  const base = {
    id,
    createdAt: Date.now(),
    intent,
    snapshot,
    transcript: [adv, skp, jl],
    verdict,
  };
  const commitHash = hashSignal(base);
  const signal: Signal = {
    ...base,
    commitHash,
    committedAt: Date.now(),
    revealedAt: null,
    status: verdict.ruling === "REJECT" ? "rejected" : "pending",
  };
  await saveSignal(signal);
  emit({ type: "commit", hash: commitHash, id });
  await sleep(pace * 0.7);

  emit({ type: "proposal", signal });
  return signal;
}
