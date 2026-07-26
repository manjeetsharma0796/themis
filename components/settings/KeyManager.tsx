"use client";
// BYOK — paste keys, load each provider's live model list, pick a model.
// Persisted to localStorage; sent with every /api/chat request.
import { useEffect, useState } from "react";
import { loadConfig, saveConfig } from "@/lib/config";

const PROVIDERS = [
  { id: "openrouter", label: "OpenRouter", hint: "one key, hundreds of models · openrouter.ai/keys" },
  { id: "mistral", label: "Mistral", hint: "console.mistral.ai" },
  { id: "nvidia", label: "NVIDIA NIM", hint: "build.nvidia.com" },
  { id: "gemini", label: "Google Gemini", hint: "aistudio.google.com/apikey" },
];

export function KeyManager({ onSaved }: { onSaved?: () => void }) {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [models, setModels] = useState<Record<string, string>>({});
  const [lists, setLists] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const c = loadConfig();
    setKeys(c.keys ?? {});
    setModels(c.models ?? {});
  }, []);

  const loadModels = async (id: string) => {
    if (!keys[id]) return;
    setLoading(id);
    setErr((e) => ({ ...e, [id]: "" }));
    try {
      const r = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: id, key: keys[id] }),
      });
      const j = await r.json();
      if (j.models?.length) {
        setLists((m) => ({ ...m, [id]: j.models.map((x: { id: string }) => x.id) }));
      } else {
        setErr((e) => ({ ...e, [id]: j.error ?? "no models returned" }));
      }
    } catch {
      setErr((e) => ({ ...e, [id]: "fetch failed" }));
    } finally {
      setLoading(null);
    }
  };

  const save = () => {
    saveConfig({ keys, models });
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
    onSaved?.();
  };

  return (
    <section className="keyline-soft rounded bg-surface p-5">
      <h3 className="font-serif text-lg font-medium">API keys · BYOK</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Stored in this browser and remembered forever. Sent only to your own Themis server, per
        request. The copilot tries providers top-to-bottom and rolls over on error.
      </p>

      <div className="mt-4 space-y-4">
        {PROVIDERS.map((p) => (
          <div key={p.id} className="rounded bg-ink p-3">
            <div className="flex items-baseline justify-between">
              <label className="font-mono text-xs font-medium text-parchment">{p.label}</label>
              <span className="font-mono text-[9px] text-faint">{p.hint}</span>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="password"
                value={keys[p.id] ?? ""}
                onChange={(e) => setKeys((k) => ({ ...k, [p.id]: e.target.value }))}
                placeholder={`${p.label} API key`}
                className="min-w-0 flex-1 rounded bg-surface px-3 py-2 font-mono text-xs text-parchment outline-none ring-1 ring-transparent focus:ring-hairline"
              />
              <button
                onClick={() => loadModels(p.id)}
                disabled={!keys[p.id] || loading === p.id}
                className="keyline-soft shrink-0 rounded px-3 font-mono text-[11px] text-muted transition-colors hover:text-brass disabled:opacity-40"
              >
                {loading === p.id ? "loading…" : "load models"}
              </button>
            </div>
            {lists[p.id]?.length ? (
              <select
                value={models[p.id] ?? ""}
                onChange={(e) => setModels((m) => ({ ...m, [p.id]: e.target.value }))}
                className="mt-2 w-full rounded bg-surface px-3 py-2 font-mono text-xs text-parchment outline-none ring-1 ring-transparent focus:ring-hairline"
              >
                <option value="">default model</option>
                {lists[p.id].map((mid) => (
                  <option key={mid} value={mid}>
                    {mid}
                  </option>
                ))}
              </select>
            ) : null}
            {err[p.id] && <p className="mt-2 font-mono text-[10px] text-down">{err[p.id]}</p>}
          </div>
        ))}
      </div>

      <button
        onClick={save}
        className="mt-4 w-full rounded bg-brass px-4 py-2.5 font-mono text-sm font-semibold text-ink transition-transform hover:-translate-y-px"
      >
        {saved ? "✓ saved — remembered forever" : "Save keys"}
      </button>
    </section>
  );
}
