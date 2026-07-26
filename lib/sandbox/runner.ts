// Sandbox script runner — writes agent-authored code to a temp dir and executes
// it (node / python / bash) with a hard timeout. LOCAL ONLY (gated), and it is a
// convenience sandbox, not strong isolation. For untrusted/production isolation,
// swap spawn for Vercel Sandbox (Firecracker microVMs) or E2B — same tool shape.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ToolDef } from "@/lib/llm/types";

export function sandboxEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.THEMIS_SANDBOX === "1";
}

type Lang = "node" | "python" | "bash";
const RUN: Record<Lang, { file: string; cmd: string }> = {
  node: { file: "script.mjs", cmd: "node" },
  python: { file: "script.py", cmd: "python3" },
  bash: { file: "script.sh", cmd: "bash" },
};

function normLang(l: string): Lang {
  const s = (l || "").toLowerCase();
  if (s.startsWith("py")) return "python";
  if (s === "bash" || s === "sh" || s === "shell") return "bash";
  return "node";
}

export async function runScript(
  language: string,
  code: string
): Promise<{ ok: boolean; output: string }> {
  if (!sandboxEnabled()) return { ok: false, output: "Sandbox is local-only (disabled in this runtime)." };
  if (!code.trim()) return { ok: false, output: "No code provided." };
  const lang = normLang(language);
  const spec = RUN[lang];

  let dir: string;
  try {
    dir = mkdtempSync(join(tmpdir(), "themis-sbx-"));
  } catch (e) {
    return { ok: false, output: `sandbox setup failed: ${e instanceof Error ? e.message : e}` };
  }
  const file = join(dir, spec.file);
  try {
    writeFileSync(file, code);
  } catch {
    return { ok: false, output: "could not write script" };
  }

  const cleanup = () => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  };

  // Dynamic import keeps the bundler from statically analyzing the spawn call.
  const { spawn } = await import("node:child_process");
  const cmd = lang === "python" ? "python3" : lang === "bash" ? "bash" : "node";

  return await new Promise((resolve) => {
    let out = "";
    const append = (d: Buffer) => {
      out += d.toString();
      if (out.length > 20000) out = out.slice(-20000);
    };
    const proc = spawn(cmd, [file], { cwd: dir, timeout: 15_000 });
    proc.stdout?.on("data", append);
    proc.stderr?.on("data", append);
    proc.on("error", (e) => {
      cleanup();
      resolve({ ok: false, output: out.trim() || `spawn error: ${e.message}` });
    });
    proc.on("close", (code, signal) => {
      cleanup();
      if (signal === "SIGTERM") return resolve({ ok: false, output: `${out.trim()}\n[timed out after 15s]`.trim() });
      resolve({ ok: code === 0, output: out.trim() || "(no output)" });
    });
  });
}

export function sandboxTools(): ToolDef[] {
  if (!sandboxEnabled()) return [];
  return [
    {
      type: "function",
      function: {
        name: "run_script",
        description:
          "Write and run a short script in a local sandbox (node, python, or bash) and return its output. Use for calculations, quick data pulls, or verifying code. 15s timeout.",
        parameters: {
          type: "object",
          properties: {
            language: { type: "string", enum: ["node", "python", "bash"] },
            code: { type: "string", description: "the full script source" },
          },
          required: ["language", "code"],
        },
      },
    },
  ];
}
export const SANDBOX_NAMES = new Set(["run_script"]);

export async function executeSandbox(name: string, argsStr: string): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = argsStr ? JSON.parse(argsStr) : {};
  } catch {
    /* empty */
  }
  if (name === "run_script") {
    const r = await runScript(String(args.language ?? "node"), String(args.code ?? ""));
    return r.output.slice(0, 4000);
  }
  return `Unknown sandbox tool ${name}.`;
}
