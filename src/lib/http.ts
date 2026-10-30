export class HttpError extends Error {
  constructor(
    message: string,
    public status?: number,
    public url?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface FetchOptions {
  headers?: Record<string, string>;
  /** Reintentos tras el primer intento, solo para 429, 5xx y errores de red. */
  retries?: number;
  timeoutMs?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const { headers, retries = 2, timeoutMs = 12_000 } = opts;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", ...headers },
        cache: "no-store",
        signal: controller.signal,
      });

      if (res.ok) {
        try {
          return (await res.json()) as T;
        } catch {
          throw new HttpError("Respuesta que no es JSON válido", res.status, url);
        }
      }

      const retryable = res.status === 429 || res.status >= 500;
      const err = new HttpError(`HTTP ${res.status}`, res.status, url);
      if (!retryable || attempt === retries) throw err;

      const retryAfter = Number(res.headers.get("retry-after"));
      const wait =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 15_000)
          : 500 * 2 ** attempt;
      lastError = err;
      await sleep(wait);
    } catch (e) {
      if (e instanceof HttpError) {
        if (!(e.status === 429 || (e.status ?? 0) >= 500) || attempt === retries) throw e;
        lastError = e;
        continue;
      }
      // Red caída o tiempo agotado.
      lastError = e;
      if (attempt === retries) {
        const reason = e instanceof Error ? e.message : String(e);
        throw new HttpError(`Fallo de red: ${reason}`, undefined, url);
      }
      await sleep(500 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new HttpError("Error desconocido", undefined, url);
}

/** Limita cuántas tareas asíncronas corren a la vez. */
export function createLimiter(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    active--;
    queue.shift()?.();
  };
  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((resolve) => queue.push(resolve));
    active++;
    try {
      return await fn();
    } finally {
      next();
    }
  };
}

/** Ventana deslizante de solicitudes por minuto. */
export function createRateWindow(requestsPerMinute: number) {
  const stamps: number[] = [];
  const windowMs = 60_000;
  return {
    /** Devuelve ms que habría que esperar para poder lanzar otra solicitud (0 = ya). */
    waitTime(now = Date.now()): number {
      while (stamps.length && now - stamps[0] >= windowMs) stamps.shift();
      if (stamps.length < requestsPerMinute) return 0;
      return windowMs - (now - stamps[0]);
    },
    record(now = Date.now()) {
      stamps.push(now);
    },
  };
}

export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
