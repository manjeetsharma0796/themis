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

export async function setupMcp(servers?: McpServer[]): Promise<McpBridge> {
  const clients: Client[] = [];
  const tools: ToolDef[] = [];
  const routes = new Set<string>();
  const routeMap = new Map<string, { client: Client; realName: string }>();

  for (const s of servers ?? []) {
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
