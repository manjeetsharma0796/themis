// BYOK + preferences, persisted in the browser (localStorage) — "remembered
// forever" on this device. Sent with each /api/chat request so the server-side
// router uses the user's keys/models without any redeploy or env change.
export type ThemisConfig = {
  keys: Record<string, string>; // provider id → api key
  models: Record<string, string>; // provider id → selected model
  order?: string[]; // provider fallback order
};

const KEY = "themis.config";

const EMPTY: ThemisConfig = { keys: {}, models: {} };

export function loadConfig(): ThemisConfig {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as ThemisConfig;
    return { keys: parsed.keys ?? {}, models: parsed.models ?? {}, order: parsed.order };
  } catch {
    return EMPTY;
  }
}

export function saveConfig(cfg: ThemisConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(cfg));
}

/** The subset sent to /api/chat so the router can honor BYOK keys/models. */
export function configForRequest(): ThemisConfig {
  const c = loadConfig();
  return { keys: c.keys ?? {}, models: c.models ?? {}, order: c.order };
}
