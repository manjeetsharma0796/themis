// Tiny JSON file store. Uses ./data locally; falls back to the OS temp dir on
// read-only filesystems (e.g. Vercel serverless, where only /tmp is writable).
// Never throws — reads degrade to the fallback, writes are best-effort.
// NOTE: on serverless, /tmp is ephemeral + per-instance. For durable shared state
// use Vercel KV / Upstash Redis (swap these two functions).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PRIMARY = join(process.cwd(), "data");
const FALLBACK = join(tmpdir(), "themis-data");
let dataDir = PRIMARY;

function ensureDir(): boolean {
  try {
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
    return true;
  } catch {
    if (dataDir !== FALLBACK) {
      dataDir = FALLBACK;
      try {
        if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export function readJson<T>(name: string, fallback: T): T {
  try {
    if (!ensureDir()) return fallback;
    const file = join(dataDir, `${name}.json`);
    if (!existsSync(file)) return fallback;
    return JSON.parse(readFileSync(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(name: string, value: T): void {
  try {
    if (!ensureDir()) return;
    writeFileSync(join(dataDir, `${name}.json`), JSON.stringify(value, null, 2), "utf-8");
  } catch {
    /* best-effort; serverless fs is ephemeral */
  }
}
