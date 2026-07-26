// OpenAI-compatible chat types — shared shape across Mistral / NVIDIA / Gemini.
export type Role = "system" | "user" | "assistant" | "tool";

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatMessage = {
  role: Role;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string; // when role === "tool"
  name?: string;
};

export type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
  };
};

export type LlmResult = {
  content: string | null;
  toolCalls: ToolCall[];
  provider: string;
  model: string;
};
