// The fallback router: try each keyed provider in order until one answers.
// One provider rate-limiting or erroring rolls over to the next automatically.
import type { ChatMessage, LlmResult, ToolCall, ToolDef } from "@/lib/llm/types";
import { liveProviders } from "@/lib/llm/providers";

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
  onAttempt?: (a: Attempt) => void
): Promise<LlmResult> {
  const provs = liveProviders();
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
