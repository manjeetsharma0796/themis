// ACP tools exposed to the copilot — only present when a local code-agent CLI
// is available (local runtime). The copilot can spin one up, poll, and stop it.
import type { ToolDef } from "@/lib/llm/types";
import {
  agentStatus,
  availableAgents,
  startAgent,
  stopAgent,
  type AcpAgent,
} from "@/lib/acp/runner";

export const ACP_TOOL_NAMES = new Set(["run_code_agent", "code_agent_status", "code_agent_stop"]);

export function acpTools(): ToolDef[] {
  const agents = availableAgents();
  if (!agents.length) return [];
  return [
    {
      type: "function",
      function: {
        name: "run_code_agent",
        description: `Spawn a LOCAL coding agent (${agents.join(" / ")}) in the background to write and run code for a task (e.g. a script, a query, a fix). Returns a session id — then poll code_agent_status.`,
        parameters: {
          type: "object",
          properties: {
            agent: { type: "string", enum: agents, description: "which local agent" },
            task: { type: "string", description: "the coding task, described in detail" },
          },
          required: ["agent", "task"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "code_agent_status",
        description: "Check a running code agent's status and latest output.",
        parameters: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "code_agent_stop",
        description: "Stop a running code agent by id.",
        parameters: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    },
  ];
}

export async function executeAcpTool(name: string, argsStr: string): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = argsStr ? JSON.parse(argsStr) : {};
  } catch {
    /* empty */
  }
  if (name === "run_code_agent") {
    const r = startAgent((args.agent as AcpAgent) ?? "claude", String(args.task ?? ""));
    if ("error" in r) return r.error;
    return `Started ${args.agent} (session ${r.id}) in the background. Poll code_agent_status with id="${r.id}".`;
  }
  if (name === "code_agent_status") {
    const r = agentStatus(String(args.id ?? ""));
    if ("error" in r) return r.error;
    return `[${r.agent} · ${r.status}]\n${r.output || "(no output yet)"}`;
  }
  if (name === "code_agent_stop") {
    const r = stopAgent(String(args.id ?? ""));
    if ("error" in r) return r.error;
    return `Stopped ${r.id}.`;
  }
  return `Unknown ACP tool ${name}.`;
}
