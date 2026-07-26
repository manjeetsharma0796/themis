// POST /api/models — dynamic model list for a provider.
// Proxies the provider's OpenAI-compatible GET /models with the supplied key
// (BYOK) or the env key. Works for OpenRouter's large catalog too.
import { registryList } from "@/lib/llm/providers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { provider, key } = (await req.json().catch(() => ({}))) as {
    provider?: string;
    key?: string;
  };
  const reg = registryList().find((r) => r.id === provider);
  if (!reg) return Response.json({ error: "unknown provider" }, { status: 400 });

  const apiKey = key || process.env[reg.envKey];
  if (!apiKey) return Response.json({ error: "no key for this provider" }, { status: 400 });

  try {
    const res = await fetch(`${reg.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      return Response.json({ error: `provider ${res.status}` }, { status: 502 });
    }
    const json = await res.json();
    const raw: unknown[] = json?.data ?? json?.models ?? [];
    const models = raw
      .map((m) => {
        const o = m as { id?: string; name?: string };
        return { id: o.id ?? o.name ?? "" };
      })
      .filter((m) => m.id)
      .sort((a, b) => a.id.localeCompare(b.id));
    return Response.json({ models });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "models fetch failed" },
      { status: 502 }
    );
  }
}
