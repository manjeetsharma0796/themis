// LLM providers — all expose an OpenAI-compatible API, so one client speaks to
// all of them (incl. OpenRouter). Keys/models/order come from a per-request
// RuntimeConfig (BYOK from the browser) and fall back to env.
export type Provider = {
  id: string;
  baseUrl: string;
  apiKey: string | undefined;
  model: string;
};

export type RuntimeConfig = {
  keys?: Record<string, string | undefined>;
  models?: Record<string, string | undefined>;
  order?: string[];
};

type Reg = { baseUrl: string; envKey: string; envModel: string; defaultModel: string };

const REGISTRY: Record<string, Reg> = {
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    envKey: "OPENROUTER_API_KEY",
    envModel: "OPENROUTER_MODEL",
    defaultModel: "google/gemini-2.0-flash-exp:free",
  },
  mistral: {
    baseUrl: "https://api.mistral.ai/v1",
    envKey: "MISTRAL_API_KEY",
    envModel: "MISTRAL_MODEL",
    defaultModel: "mistral-large-latest",
  },
  nvidia: {
    baseUrl: "https://integrate.api.nvidia.com/v1",
    envKey: "NVIDIA_API_KEY",
    envModel: "NVIDIA_MODEL",
    defaultModel: "meta/llama-3.3-70b-instruct",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    envKey: "GEMINI_API_KEY",
    envModel: "GEMINI_MODEL",
    defaultModel: "gemini-2.0-flash",
  },
};

const DEFAULT_ORDER = ["openrouter", "mistral", "nvidia", "gemini"];

export function providers(cfg?: RuntimeConfig): Provider[] {
  const order = cfg?.order?.length
    ? cfg.order
    : (process.env.LLM_PROVIDER_ORDER ?? DEFAULT_ORDER.join(","))
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
  return order
    .filter((id) => REGISTRY[id])
    .map((id) => {
      const r = REGISTRY[id];
      return {
        id,
        baseUrl: r.baseUrl,
        apiKey: cfg?.keys?.[id] || process.env[r.envKey],
        model: cfg?.models?.[id] || process.env[r.envModel] || r.defaultModel,
      };
    });
}

/** Providers with a key configured (BYOK or env), in fallback order. */
export function liveProviders(cfg?: RuntimeConfig): Provider[] {
  return providers(cfg).filter((p) => p.apiKey);
}

export function hasAnyKey(cfg?: RuntimeConfig): boolean {
  return liveProviders(cfg).length > 0;
}

/** Static registry for the Settings UI + /api/models (id, endpoint, env key). */
export function registryList(): { id: string; baseUrl: string; envKey: string; defaultModel: string }[] {
  return Object.entries(REGISTRY).map(([id, r]) => ({
    id,
    baseUrl: r.baseUrl,
    envKey: r.envKey,
    defaultModel: r.defaultModel,
  }));
}
