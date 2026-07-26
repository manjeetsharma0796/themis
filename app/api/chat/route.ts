// POST /api/chat — streams a full copilot turn as Server-Sent Events.
// Body: { text: string, history?: {role,content}[], config?: RuntimeConfig }
// config carries BYOK keys/models/order from the browser (overrides env).
import type { ChatMessage } from "@/lib/llm/types";
import type { RuntimeConfig } from "@/lib/llm/providers";
import { runCopilot, type ChatEvent } from "@/lib/agent/copilot";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    text?: string;
    history?: { role: string; content: string }[];
    config?: RuntimeConfig;
  };
  if (!body.text || !body.text.trim()) {
    return Response.json({ error: "text required" }, { status: 400 });
  }

  const history: ChatMessage[] = (body.history ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
    .slice(-12)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: ChatEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        await runCopilot(history, body.text!, emit, body.config);
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : "chat failed" });
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
