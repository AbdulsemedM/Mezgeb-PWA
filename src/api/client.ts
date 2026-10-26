import { config } from '../app/config';

/** A refusal from the API: `{ code, message, details? }` (CLAUDE.md conventions). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

/** No answer from the server: no internet, or the server is unreachable. Never an "error" to show. */
export class OfflineError extends Error {
  constructor() {
    super('offline');
    this.name = 'OfflineError';
  }
}

export interface RequestOptions {
  body?: unknown;
  /** Send the access token (default true). */
  auth?: boolean;
  signal?: AbortSignal;
  /** Raw body (e.g. an image); sent as is with this content type. */
  raw?: { body: Blob; type: string };
}

/** Supplies and renews the access token; set by the session module. */
export interface TokenSource {
  accessToken(): Promise<string | null>;
  /** Called on 401 `token_expired`: renew and return the new token, or null when signed out. */
  renew(): Promise<string | null>;
}

let tokens: TokenSource | null = null;

export function setTokenSource(source: TokenSource | null): void {
  tokens = source;
}

export function apiUrl(path: string): string {
  return `${config.apiUrl}${path}`;
}

/**
 * JSON request to the API. The refresh cookie rides along (`credentials: include`); a 401
 * `token_expired` renews the access token once and retries.
 */
export async function api<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await send(method, path, opts, await authHeader(opts));
  if (res.status === 401 && opts.auth !== false && tokens) {
    const problem = await readError(res.clone());
    if (problem.code === 'token_expired' || problem.code === 'unauthorized') {
      const renewed = await tokens.renew();
      if (renewed) {
        return parse<T>(await send(method, path, opts, { authorization: `Bearer ${renewed}` }));
      }
    }
  }
  return parse<T>(res);
}

/** The raw response for binary downloads (statement PDF). */
export async function apiBlob(path: string): Promise<Blob> {
  let res = await send('GET', path, {}, await authHeader({}));
  if (res.status === 401 && tokens) {
    const renewed = await tokens.renew();
    if (renewed) res = await send('GET', path, {}, { authorization: `Bearer ${renewed}` });
  }
  if (!res.ok) {
    const e = await readError(res);
    throw new ApiError(res.status, e.code, e.details);
  }
  return res.blob();
}

async function authHeader(opts: RequestOptions): Promise<Record<string, string>> {
  if (opts.auth === false || !tokens) return {};
  const token = await tokens.accessToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function send(
  method: string,
  path: string,
  opts: RequestOptions,
  headers: Record<string, string>,
): Promise<Response> {
  const h: Record<string, string> = { accept: 'application/json', ...headers };
  let body: BodyInit | undefined;
  if (opts.raw) {
    h['content-type'] = opts.raw.type;
    body = opts.raw.body;
  } else if (opts.body !== undefined) {
    h['content-type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  try {
    return await fetch(apiUrl(path), {
      method,
      headers: h,
      body,
      credentials: 'include',
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new OfflineError();
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (res.ok) {
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
  // A proxy or captive portal with no JSON is the same as no internet for the person.
  if (res.status === 502 || res.status === 503 || res.status === 504) throw new OfflineError();
  const e = await readError(res);
  throw new ApiError(res.status, e.code, e.details);
}

async function readError(
  res: Response,
): Promise<{ code: string; details?: Record<string, unknown> }> {
  try {
    const json = (await res.json()) as { code?: string; details?: Record<string, unknown> };
    return { code: json.code ?? `http_${res.status}`, details: json.details };
  } catch {
    return { code: `http_${res.status}` };
  }
}
