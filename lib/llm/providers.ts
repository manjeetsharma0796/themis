// LLM providers — all three expose an OpenAI-compatible /chat/completions endpoint,
// so one client speaks to all of them. Order + models are env-configurable.
export type Provider = {
  id: string;
  baseUrl: string;
  apiKey: string | undefined;
  model: string;
};

export function providers(): Provider[] {
  const all: Record<string, Provider> = {
    mistral: {
      id: "mistral",
      baseUrl: "https://api.mistral.ai/v1",
      apiKey: process.env.MISTRAL_API_KEY,
      model: process.env.MISTRAL_MODEL ?? "mistral-large-latest",
    },
    nvidia: {
      id: "nvidia",
      baseUrl: "https://integrate.api.nvidia.com/v1",
      apiKey: process.env.NVIDIA_API_KEY,
      model: process.env.NVIDIA_MODEL ?? "meta/llama-3.3-70b-instruct",
    },
    gemini: {
      id: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    },
  };
  const order = (process.env.LLM_PROVIDER_ORDER ?? "mistral,nvidia,gemini")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return order.map((id) => all[id]).filter(Boolean);
}

/** Providers that actually have a key configured, in fallback order. */
export function liveProviders(): Provider[] {
  return providers().filter((p) => p.apiKey);
}

export function hasAnyKey(): boolean {
  return liveProviders().length > 0;
}
