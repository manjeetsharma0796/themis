"use client";
// Manage HTTP (Streamable) MCP servers. The copilot connects to these per
// request and can call their tools mid-conversation. Persisted in localStorage.
import { useEffect, useState } from "react";
import { loadConfig, saveConfig, type McpServer } from "@/lib/config";

export function McpManager() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setServers(loadConfig().mcpServers ?? []);
  }, []);

  const persist = (next: McpServer[]) => {
    const c = loadConfig();
    saveConfig({ ...c, keys: c.keys ?? {}, models: c.models ?? {}, mcpServers: next });
    setServers(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const add = () => {
    if (!name.trim() || !url.trim()) return;
    persist([...servers, { name: name.trim(), url: url.trim() }]);
    setName("");
    setUrl("");
  };

  return (
    <section className="keyline-soft rounded bg-surface p-5">
      <h3 className="font-serif text-lg font-medium">MCP servers</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Connect HTTP (Streamable) MCP servers — the copilot can call their tools mid-conversation.
        Stored in this browser, sent per request.
      </p>

      <div className="mt-4 space-y-2">
        {servers.length === 0 && <p className="font-mono text-xs text-faint">no servers yet</p>}
        {servers.map((s, i) => (
          <div key={`${s.name}-${i}`} className="flex items-center justify-between gap-2 rounded bg-ink px-3 py-2">
            <div className="min-w-0">
              <p className="font-mono text-xs text-parchment">{s.name}</p>
              <p className="truncate font-mono text-[10px] text-faint">{s.url}</p>
            </div>
            <button
              onClick={() => persist(servers.filter((_, idx) => idx !== i))}
              className="shrink-0 font-mono text-[10px] text-faint transition-colors hover:text-down"
            >
              remove
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="name"
          className="rounded bg-ink px-3 py-2 font-mono text-xs text-parchment outline-none ring-1 ring-transparent focus:ring-hairline sm:w-32"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…/mcp"
          className="min-w-0 flex-1 rounded bg-ink px-3 py-2 font-mono text-xs text-parchment outline-none ring-1 ring-transparent focus:ring-hairline"
        />
        <button
          onClick={add}
          disabled={!name.trim() || !url.trim()}
          className="rounded bg-brass px-4 py-2 font-mono text-xs font-semibold text-ink transition-transform hover:-translate-y-px disabled:opacity-40"
        >
          add
        </button>
      </div>
      {saved && <p className="mt-2 font-mono text-[10px] text-up">✓ saved</p>}
    </section>
  );
}
