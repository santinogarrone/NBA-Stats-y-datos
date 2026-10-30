import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Caché en memoria con TTL, deduplicación de solicitudes en vuelo y persistencia en
 * disco para datos inmutables (partidos finalizados). Si el origen falla y hay un valor
 * caducado, se devuelve marcado como `stale`.
 */
interface Entry {
  value: unknown;
  fetchedAt: number;
  expiresAt: number;
}

interface Store {
  mem: Map<string, Entry>;
  inflight: Map<string, Promise<Entry>>;
}

const g = globalThis as unknown as { __nbaCache?: Store };
const store: Store = (g.__nbaCache ??= { mem: new Map(), inflight: new Map() });

const CACHE_DIR = process.env.NBA_CACHE_DIR ?? path.join(os.tmpdir(), "nba-stats-cache");

function diskPath(key: string): string {
  return path.join(CACHE_DIR, `${createHash("sha1").update(key).digest("hex")}.json`);
}

function readDisk(key: string): Entry | null {
  try {
    const raw = JSON.parse(fs.readFileSync(diskPath(key), "utf8")) as {
      key: string;
      fetchedAt: number;
      value: unknown;
    };
    if (raw.key !== key) return null;
    return { value: raw.value, fetchedAt: raw.fetchedAt, expiresAt: Infinity };
  } catch {
    return null;
  }
}

function writeDisk(key: string, entry: Entry): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const file = diskPath(key);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ key, fetchedAt: entry.fetchedAt, value: entry.value }));
    fs.renameSync(tmp, file);
  } catch {
    // Sin disco no se pierde funcionalidad, solo se repiten consultas.
  }
}

export interface CacheOptions<T> {
  ttlMs: number;
  /** true, o una función que decide según el valor, para guardar sin caducidad y en disco. */
  persist?: boolean | ((value: T) => boolean);
}

export interface CachedResult<T> {
  value: T;
  fetchedAt: string;
  hit: boolean;
  stale: boolean;
}

function fresh(entry: Entry | undefined, now: number): boolean {
  return !!entry && entry.expiresAt > now;
}

/** ¿Hay un dato vigente sin salir a la red? Sirve para repartir el presupuesto de solicitudes. */
export function hasFresh(key: string, checkDisk = false): boolean {
  const now = Date.now();
  if (fresh(store.mem.get(key), now)) return true;
  if (checkDisk) {
    const d = readDisk(key);
    if (d) {
      store.mem.set(key, d);
      return true;
    }
  }
  return false;
}

export async function cached<T>(
  key: string,
  opts: CacheOptions<T>,
  loader: () => Promise<T>,
): Promise<CachedResult<T>> {
  const now = Date.now();
  const mem = store.mem.get(key);
  if (mem && fresh(mem, now)) {
    return { value: mem.value as T, fetchedAt: new Date(mem.fetchedAt).toISOString(), hit: true, stale: false };
  }

  if (opts.persist !== undefined && opts.persist !== false) {
    const disk = readDisk(key);
    if (disk) {
      store.mem.set(key, disk);
      return { value: disk.value as T, fetchedAt: new Date(disk.fetchedAt).toISOString(), hit: true, stale: false };
    }
  }

  let pending = store.inflight.get(key);
  if (!pending) {
    pending = (async () => {
      const value = await loader();
      const persistNow =
        typeof opts.persist === "function" ? opts.persist(value) : opts.persist === true;
      const entry: Entry = {
        value,
        fetchedAt: Date.now(),
        expiresAt: persistNow ? Infinity : Date.now() + opts.ttlMs,
      };
      store.mem.set(key, entry);
      if (persistNow) writeDisk(key, entry);
      return entry;
    })().finally(() => store.inflight.delete(key));
    store.inflight.set(key, pending);
  }

  try {
    const entry = await pending;
    return { value: entry.value as T, fetchedAt: new Date(entry.fetchedAt).toISOString(), hit: false, stale: false };
  } catch (error) {
    if (mem) {
      return { value: mem.value as T, fetchedAt: new Date(mem.fetchedAt).toISOString(), hit: true, stale: true };
    }
    throw error;
  }
}

/** Descarta lo que caduca (en vivo, clasificaciones). Lo inmutable en disco se conserva. */
export function clearVolatile(): number {
  let removed = 0;
  for (const [key, entry] of store.mem) {
    if (entry.expiresAt !== Infinity) {
      store.mem.delete(key);
      removed++;
    }
  }
  return removed;
}

/** Presupuesto de solicitudes externas nuevas para una carga de página. */
export class FetchBudget {
  used = 0;
  constructor(public readonly max: number) {}
  get remaining(): number {
    return Math.max(0, this.max - this.used);
  }
  /** Reserva una solicitud. Devuelve false si el presupuesto se agotó. */
  take(): boolean {
    if (this.used >= this.max) return false;
    this.used++;
    return true;
  }
}
