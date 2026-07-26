// BYOK + preferences, persisted in the browser (localStorage) — "remembered
// forever" on this device. Sent with each /api/chat request so the server-side
// router uses the user's keys/models/MCP servers without any redeploy or env change.
export type McpServer = { name: string; url: string };

export type ThemisConfig = {
  keys: Record<string, string>; // provider id → api key
  models: Record<string, string>; // provider id → selected model
  order?: string[]; // provider fallback order
  mcpServers?: McpServer[]; // HTTP MCP servers the copilot may call
};

const KEY = "themis.config";

const EMPTY: ThemisConfig = { keys: {}, models: {}, mcpServers: [] };

export function loadConfig(): ThemisConfig {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as ThemisConfig;
    return {
      keys: parsed.keys ?? {},
      models: parsed.models ?? {},
      order: parsed.order,
      mcpServers: parsed.mcpServers ?? [],
    };
  } catch {
    return EMPTY;
  }
}

export function saveConfig(cfg: ThemisConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(cfg));
}

/** The subset sent to /api/chat so the router honors BYOK keys/models + MCP servers. */
export function configForRequest(): ThemisConfig {
  const c = loadConfig();
  return {
    keys: c.keys ?? {},
    models: c.models ?? {},
    order: c.order,
    mcpServers: c.mcpServers ?? [],
  };
}
