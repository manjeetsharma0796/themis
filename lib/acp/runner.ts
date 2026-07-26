// ACP-style local code-agent runner. Spawns local CLIs (Claude Code / Codex /
// Gemini) in headless mode and streams their output. LOCAL ONLY: gated to a
// non-production runtime + CLI presence — a deployed server can't (and shouldn't)
// spawn the user's local agents.
import { execSync, spawn, type ChildProcess } from "node:child_process";

export type AcpAgent = "claude" | "codex" | "gemini";

type Session = {
  id: string;
  agent: AcpAgent;
  task: string;
  status: "running" | "done" | "error" | "stopped";
  output: string;
  startedAt: number;
  proc?: ChildProcess;
};

const SESSIONS = new Map<string, Session>();

// Headless / print-mode invocation per agent.
const CMD: Record<AcpAgent, (task: string) => { cmd: string; args: string[] }> = {
  claude: (task) => ({ cmd: "claude", args: ["-p", task] }),
  codex: (task) => ({ cmd: "codex", args: ["exec", task] }),
  gemini: (task) => ({ cmd: "gemini", args: ["-p", task] }),
};

export function acpEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.THEMIS_ACP === "1";
}

let availCache: AcpAgent[] | null = null;
export function availableAgents(): AcpAgent[] {
  if (!acpEnabled()) return [];
  if (availCache) return availCache;
  const found: AcpAgent[] = [];
  for (const a of ["claude", "codex", "gemini"] as AcpAgent[]) {
    try {
      execSync(`command -v ${a}`, { stdio: "ignore" });
      found.push(a);
    } catch {
      /* not installed */
    }
  }
  availCache = found;
  return found;
}

let n = 0;
export function startAgent(agent: AcpAgent, task: string): { id: string } | { error: string } {
  if (!acpEnabled()) return { error: "ACP is local-only (disabled in this runtime)." };
  if (!availableAgents().includes(agent)) return { error: `${agent} CLI not found on this machine.` };
  if (!task.trim()) return { error: "task is required" };

  const { cmd, args } = CMD[agent](task);
  const id = `acp_${Date.now().toString(36)}_${n++}`;
  const session: Session = { id, agent, task, status: "running", output: "", startedAt: Date.now() };
  try {
    const proc = spawn(cmd, args, { env: process.env, cwd: process.env.HOME || process.cwd() });
    session.proc = proc;
    const append = (d: Buffer) => {
      session.output += d.toString();
      if (session.output.length > 20000) session.output = session.output.slice(-20000);
    };
    proc.stdout?.on("data", append);
    proc.stderr?.on("data", append);
    proc.on("close", (code) => {
      if (session.status === "running") session.status = code === 0 ? "done" : "error";
    });
    proc.on("error", (e) => {
      session.status = "error";
      session.output += `\n[spawn error] ${e.message}`;
    });
  } catch (e) {
    session.status = "error";
    session.output = e instanceof Error ? e.message : "spawn failed";
  }
  SESSIONS.set(id, session);
  return { id };
}

export function agentStatus(
  id: string
): { error: string } | { id: string; agent: AcpAgent; status: Session["status"]; output: string; task: string } {
  const s = SESSIONS.get(id);
  if (!s) return { error: "unknown session" };
  return { id, agent: s.agent, status: s.status, output: s.output.slice(-4000), task: s.task };
}

export function stopAgent(
  id: string
): { error: string } | { id: string; status: Session["status"] } {
  const s = SESSIONS.get(id);
  if (!s) return { error: "unknown session" };
  try {
    s.proc?.kill("SIGTERM");
  } catch {
    /* already gone */
  }
  s.status = "stopped";
  return { id, status: "stopped" };
}
