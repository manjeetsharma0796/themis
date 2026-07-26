// The fallback router: try each keyed provider in order until one answers.
// One provider rate-limiting or erroring rolls over to the next automatically.
import type { ChatMessage, LlmResult, ToolCall, ToolDef } from "@/lib/llm/types";
import { liveProviders, type RuntimeConfig } from "@/lib/llm/providers";

export class NoProvidersError extends Error {
  constructor() {
    super("No LLM provider keys configured");
    this.name = "NoProvidersError";
  }
}

export type Attempt = { provider: string; ok: boolean; error?: string };

export async function llmChat(
  messages: ChatMessage[],
  tools?: ToolDef[],
  onAttempt?: (a: Attempt) => void,
  cfg?: RuntimeConfig
): Promise<LlmResult> {
  const provs = liveProviders(cfg);
  if (provs.length === 0) throw new NoProvidersError();

  let lastErr = "unknown error";
  for (const p of provs) {
    try {
      const res = await fetch(`${p.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${p.apiKey}`,
        },
        body: JSON.stringify({
          model: p.model,
          messages,
          ...(tools && tools.length ? { tools, tool_choice: "auto" } : {}),
          temperature: 0.4,
        }),
      });
      if (!res.ok) {
        lastErr = `${p.id} → ${res.status} ${(await res.text()).slice(0, 160)}`;
        onAttempt?.({ provider: p.id, ok: false, error: `${res.status}` });
        continue;
      }
      const json = await res.json();
      const msg = json?.choices?.[0]?.message;
      if (!msg) {
        lastErr = `${p.id} → empty response`;
        onAttempt?.({ provider: p.id, ok: false, error: "empty" });
        continue;
      }
      onAttempt?.({ provider: p.id, ok: true });
      return {
        content: msg.content ?? null,
        toolCalls: (msg.tool_calls ?? []) as ToolCall[],
        provider: p.id,
        model: p.model,
      };
    } catch (err) {
      lastErr = `${p.id} → ${err instanceof Error ? err.message : String(err)}`;
      onAttempt?.({ provider: p.id, ok: false, error: "network" });
    }
  }
  throw new Error(`All providers failed. Last: ${lastErr}`);
}

export type StreamHandlers = {
  onToken?: (t: string) => void;
  onAttempt?: (a: Attempt) => void;
};

/** Streaming variant: emits content tokens via onToken and assembles tool calls
 *  from deltas. Same provider fallback (rolls over before the stream starts). */
export async function llmChatStream(
  messages: ChatMessage[],
  tools: ToolDef[] | undefined,
  handlers: StreamHandlers,
  cfg?: RuntimeConfig
): Promise<LlmResult> {
  const provs = liveProviders(cfg);
  if (provs.length === 0) throw new NoProvidersError();

  let lastErr = "unknown error";
  for (const p of provs) {
    try {
      const res = await fetch(`${p.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.apiKey}` },
        body: JSON.stringify({
          model: p.model,
          messages,
          ...(tools && tools.length ? { tools, tool_choice: "auto" } : {}),
          temperature: 0.4,
          stream: true,
        }),
      });
      if (!res.ok || !res.body) {
        lastErr = `${p.id} → ${res.status}`;
        handlers.onAttempt?.({ provider: p.id, ok: false, error: `${res.status}` });
        continue;
      }
      handlers.onAttempt?.({ provider: p.id, ok: true });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let content = "";
      const toolAcc: Record<number, { id?: string; name?: string; args: string }> = {};

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const s = line.trim();
          if (!s.startsWith("data:")) continue;
          const data = s.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          let json: unknown;
          try {
            json = JSON.parse(data);
          } catch {
            continue;
          }
          const delta = (json as { choices?: { delta?: Record<string, unknown> }[] })?.choices?.[0]?.delta;
          if (!delta) continue;
          if (typeof delta.content === "string" && delta.content) {
            content += delta.content;
            handlers.onToken?.(delta.content);
          }
          const tcs = delta.tool_calls as
            | { index?: number; id?: string; function?: { name?: string; arguments?: string } }[]
            | undefined;
          if (Array.isArray(tcs)) {
            for (const tc of tcs) {
              const idx = tc.index ?? 0;
              const acc = (toolAcc[idx] ??= { args: "" });
              if (tc.id) acc.id = tc.id;
              if (tc.function?.name) acc.name = tc.function.name;
              if (tc.function?.arguments) acc.args += tc.function.arguments;
            }
          }
        }
      }

      const toolCalls: ToolCall[] = Object.values(toolAcc)
        .filter((t) => t.name)
        .map((t, i) => ({
          id: t.id ?? `call_${i}`,
          type: "function" as const,
          function: { name: t.name as string, arguments: t.args },
        }));

      return { content: content || null, toolCalls, provider: p.id, model: p.model };
    } catch (err) {
      lastErr = `${p.id} → ${err instanceof Error ? err.message : String(err)}`;
      handlers.onAttempt?.({ provider: p.id, ok: false, error: "network" });
    }
  }
  throw new Error(`All providers failed (stream). Last: ${lastErr}`);
}
