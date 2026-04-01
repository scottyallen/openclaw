import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { SessionEntry } from "./types.js";

const log = createSubsystemLogger("sessions/cache");

type SessionStoreCacheEntry = {
  store: Record<string, SessionEntry>;
  loadedAt: number;
  storePath: string;
  mtimeMs?: number;
  sizeBytes?: number;
  serialized?: string;
};

const SESSION_STORE_CACHE = new Map<string, SessionStoreCacheEntry>();
const SESSION_STORE_SERIALIZED_CACHE = new Map<string, string>();

export function clearSessionStoreCaches(): void {
  SESSION_STORE_CACHE.clear();
  SESSION_STORE_SERIALIZED_CACHE.clear();
}

export function invalidateSessionStoreCache(storePath: string): void {
  SESSION_STORE_CACHE.delete(storePath);
  SESSION_STORE_SERIALIZED_CACHE.delete(storePath);
}

export function getSerializedSessionStore(storePath: string): string | undefined {
  return SESSION_STORE_SERIALIZED_CACHE.get(storePath);
}

export function setSerializedSessionStore(storePath: string, serialized?: string): void {
  if (serialized === undefined) {
    SESSION_STORE_SERIALIZED_CACHE.delete(storePath);
    return;
  }
  SESSION_STORE_SERIALIZED_CACHE.set(storePath, serialized);
}

export function dropSessionStoreObjectCache(storePath: string): void {
  SESSION_STORE_CACHE.delete(storePath);
}

export function readSessionStoreCache(params: {
  storePath: string;
  ttlMs: number;
  mtimeMs?: number;
  sizeBytes?: number;
}): Record<string, SessionEntry> | null {
  const cached = SESSION_STORE_CACHE.get(params.storePath);
  if (!cached) {
    log.debug("session store cache miss", { storePath: params.storePath });
    return null;
  }
  const now = Date.now();
  if (now - cached.loadedAt > params.ttlMs) {
    log.debug("session store cache expired", {
      storePath: params.storePath,
      ageMs: now - cached.loadedAt,
      ttlMs: params.ttlMs,
    });
    invalidateSessionStoreCache(params.storePath);
    return null;
  }
  if (params.mtimeMs !== cached.mtimeMs || params.sizeBytes !== cached.sizeBytes) {
    log.debug("session store cache stale (file changed)", { storePath: params.storePath });
    invalidateSessionStoreCache(params.storePath);
    return null;
  }
  log.debug("session store cache hit", { storePath: params.storePath });
  return structuredClone(cached.store);
}

export function writeSessionStoreCache(params: {
  storePath: string;
  store: Record<string, SessionEntry>;
  mtimeMs?: number;
  sizeBytes?: number;
  serialized?: string;
}): void {
  SESSION_STORE_CACHE.set(params.storePath, {
    store: structuredClone(params.store),
    loadedAt: Date.now(),
    storePath: params.storePath,
    mtimeMs: params.mtimeMs,
    sizeBytes: params.sizeBytes,
    serialized: params.serialized,
  });
  if (params.serialized !== undefined) {
    SESSION_STORE_SERIALIZED_CACHE.set(params.storePath, params.serialized);
  }
}
