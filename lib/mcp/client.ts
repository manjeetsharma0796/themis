// MCP bridge — connect to HTTP (Streamable) MCP servers, expose their tools to
// the copilot, and route calls back. Tools are namespaced mcp__<server>__<tool>
// so they never collide with native tools and route cleanly.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ToolDef } from "@/lib/llm/types";

export type McpServer = { name: string; url: string };

export type McpBridge = {
  tools: ToolDef[];
  routes: Set<string>;
  call: (toolName: string, argsStr: string) => Promise<string>;
  close: () => Promise<void>;
};

const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48);

// Servers the agent adds at runtime (add_mcp_server) — kept for the server-process
// session, merged with the per-request config servers.
const sessionServers: McpServer[] = [];
export function addSessionServer(s: McpServer) {
  if (s?.url && !sessionServers.some((x) => x.url === s.url)) sessionServers.push(s);
}
export function listAllServers(cfgServers?: McpServer[]): McpServer[] {
  const seen = new Set<string>();
  const out: McpServer[] = [];
  for (const s of [...(cfgServers ?? []), ...sessionServers]) {
    if (s?.url && !seen.has(s.url)) {
      seen.add(s.url);
      out.push(s);
    }
  }
  return out;
}

export async function setupMcp(servers?: McpServer[]): Promise<McpBridge> {
  const clients: Client[] = [];
  const tools: ToolDef[] = [];
  const routes = new Set<string>();
  const routeMap = new Map<string, { client: Client; realName: string }>();

  for (const s of listAllServers(servers)) {
    if (!s?.url) continue;
    try {
      const client = new Client({ name: "themis", version: "1.0.0" }, { capabilities: {} });
      await client.connect(new StreamableHTTPClientTransport(new URL(s.url)));
      const list = await client.listTools();
      const prefix = sanitize(s.name || "mcp");
      for (const t of list.tools ?? []) {
        const fq = `mcp__${prefix}__${sanitize(t.name)}`;
        tools.push({
          type: "function",
          function: {
            name: fq,
            description: `[${s.name}] ${t.description ?? t.name}`.slice(0, 900),
            parameters:
              (t.inputSchema as Record<string, unknown>) ?? { type: "object", properties: {} },
          },
        });
        routes.add(fq);
        routeMap.set(fq, { client, realName: t.name });
      }
      clients.push(client);
    } catch {
      // unreachable / non-compliant server — skip it, don't break the turn
    }
  }

  return {
    tools,
    routes,
    call: async (toolName, argsStr) => {
      const route = routeMap.get(toolName);
      if (!route) return `MCP tool ${toolName} not found.`;
      let args: Record<string, unknown> = {};
      try {
        args = argsStr ? JSON.parse(argsStr) : {};
      } catch {
        /* empty args */
      }
      try {
        const res = await route.client.callTool({ name: route.realName, arguments: args });
        const parts = (res.content as { type: string; text?: string }[] | undefined) ?? [];
        const text = parts.map((p) => p.text ?? "").join("\n").trim();
        return text || "(tool returned no text)";
      } catch (e) {
        return `MCP call failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
    close: async () => {
      for (const c of clients) {
        try {
          await c.close();
        } catch {
          /* ignore */
        }
      }
    },
  };
}

/** Connect to a server and list its tools — used to test before adding. */
export async function testMcp(
  server: McpServer
): Promise<{ ok: boolean; count?: number; names?: string[]; error?: string }> {
  try {
    const client = new Client({ name: "themis", version: "1.0.0" }, { capabilities: {} });
    await client.connect(new StreamableHTTPClientTransport(new URL(server.url)));
    const list = await client.listTools();
    const names = (list.tools ?? []).map((t) => t.name);
    await client.close();
    return { ok: true, count: names.length, names };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Agent-facing MCP management tools — add/test/list servers mid-conversation.
export const MCP_MGMT_TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "add_mcp_server",
      description:
        "Add an MCP (Model Context Protocol) server by URL and test it by listing its tools. On success its tools become available to you from the next message.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "a short label for the server" },
          url: { type: "string", description: "the server's Streamable-HTTP MCP endpoint URL" },
        },
        required: ["name", "url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_mcp_servers",
      description: "List the MCP servers currently connected this session.",
      parameters: { type: "object", properties: {} },
    },
  },
];
export const MCP_MGMT_NAMES = new Set(["add_mcp_server", "list_mcp_servers"]);

export async function executeMcpMgmt(name: string, argsStr: string): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = argsStr ? JSON.parse(argsStr) : {};
  } catch {
    /* empty */
  }
  if (name === "add_mcp_server") {
    const url = String(args.url ?? "");
    const label = String(args.name ?? "mcp");
    if (!url) return "Provide the MCP server URL.";
    const t = await testMcp({ name: label, url });
    if (!t.ok) return `Could not connect to ${url} — ${t.error}`;
    addSessionServer({ name: label, url });
    return `Connected to "${label}" ✓ (${t.count} tools: ${(t.names ?? []).slice(0, 12).join(", ")}). Added — its tools are available from your next message.`;
  }
  if (name === "list_mcp_servers") {
    const all = listAllServers();
    return all.length
      ? `Connected MCP servers: ${all.map((s) => `${s.name} (${s.url})`).join("; ")}`
      : "No MCP servers connected yet. Add one with add_mcp_server.";
  }
  return `Unknown MCP tool ${name}.`;
}
