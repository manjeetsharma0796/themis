// JSON store. Uses Upstash Redis when configured (durable + shared across
// serverless instances) — otherwise a local file under ./data, falling back to
// the OS temp dir on read-only filesystems. Async; never throws on read.
//
// Provision Upstash via the Vercel Marketplace (Vercel KV is deprecated). It sets
// KV_REST_API_URL/TOKEN or UPSTASH_REDIS_REST_URL/TOKEN — both are read here.
import { Redis } from "@upstash/redis";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function redisFromEnv(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    return new Redis({ url, token });
  } catch {
    return null;
  }
}
const redis = redisFromEnv();
const rkey = (name: string) => `themis:${name}`;

// ── local file fallback ──────────────────────────────────────
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

function fileRead<T>(name: string, fallback: T): T {
  try {
    if (!ensureDir()) return fallback;
    const file = join(dataDir, `${name}.json`);
    if (!existsSync(file)) return fallback;
    return JSON.parse(readFileSync(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function fileWrite<T>(name: string, value: T): void {
  try {
    if (!ensureDir()) return;
    writeFileSync(join(dataDir, `${name}.json`), JSON.stringify(value, null, 2), "utf-8");
  } catch {
    /* best-effort */
  }
}

// ── public API (async) ───────────────────────────────────────
export async function readJson<T>(name: string, fallback: T): Promise<T> {
  if (redis) {
    try {
      const v = await redis.get<T>(rkey(name));
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }
  return fileRead(name, fallback);
}

export async function writeJson<T>(name: string, value: T): Promise<void> {
  if (redis) {
    try {
      await redis.set(rkey(name), value);
    } catch {
      /* best-effort */
    }
    return;
  }
  fileWrite(name, value);
}

/** True when durable (Redis) storage is active. */
export const isDurable = redis !== null;
