import { ApiError, NetworkError, describeApiError } from './errors.js';
import { VERSION } from './version.js';

const TIMEOUT_MS = 30_000;

interface SendOptions {
  apiKey?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

interface RawResponse {
  status: number;
  json: unknown;
}

function parseRetryAfterSeconds(headers: Headers): number | undefined {
  const retryAfter = headers.get('retry-after');
  if (retryAfter && /^\d+$/.test(retryAfter)) return Number(retryAfter);
  // IETF draft-8 RateLimit header: "limit=200, remaining=0, reset=42"
  const rateLimit = headers.get('ratelimit');
  if (rateLimit) {
    const match = /reset=(\d+)/.exec(rateLimit);
    if (match) return Number(match[1]);
  }
  return undefined;
}

async function send(base: string, method: string, path: string, opts: SendOptions = {}): Promise<RawResponse> {
  const url = new URL(base + path);
  if (opts.query) {
    for (const [key, value] of Object.entries(opts.query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = { 'user-agent': `md-lantern-mcp/${VERSION}` };
  let payload: string | undefined;
  if (opts.body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(opts.body);
  }
  if (opts.apiKey) headers.authorization = `Bearer ${opts.apiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: payload, signal: controller.signal });
  } catch (err) {
    throw new NetworkError(`could not reach ${base}: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const obj = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
    const code = typeof obj.error === 'string' ? obj.error : `http_${res.status}`;
    const extra: Record<string, unknown> = { ...obj };
    delete extra.error;
    if (code === 'rate_limited') {
      const retryAfter = parseRetryAfterSeconds(res.headers);
      if (retryAfter !== undefined) extra.retryAfter = retryAfter;
    }
    throw new ApiError(res.status, code, describeApiError(code, extra), extra);
  }

  return { status: res.status, json };
}

export interface ServerPage {
  token: string;
  url: string;
  rawUrl?: string;
  title?: string;
  version: number;
  updatedAt?: string | null;
  style?: string;
  manageToken?: string;
  changed?: boolean;
  [key: string]: unknown;
}

export interface SourcePage {
  token: string;
  title: string;
  markdown: string;
  version: number;
  updatedAt: string | null;
  style: string;
  breaks: boolean;
}

export async function apiPublish(base: string, apiKey: string, body: Record<string, unknown>): Promise<ServerPage> {
  const res = await send(base, 'POST', '/api/v1/publish', { apiKey, body });
  return res.json as ServerPage;
}

export async function apiGet(base: string, apiKey: string, ref: string): Promise<ServerPage> {
  const res = await send(base, 'GET', `/api/v1/pages/${encodeURIComponent(ref)}`, { apiKey });
  return res.json as ServerPage;
}

export async function apiUpdate(
  base: string,
  apiKey: string,
  token: string,
  body: Record<string, unknown>,
): Promise<ServerPage> {
  const res = await send(base, 'PUT', `/api/v1/pages/${encodeURIComponent(token)}`, { apiKey, body });
  return res.json as ServerPage;
}

export async function apiList(
  base: string,
  apiKey: string,
  opts: { limit?: number; cursor?: string },
): Promise<{ pages: ServerPage[]; nextCursor: string | null }> {
  const res = await send(base, 'GET', '/api/v1/pages', { apiKey, query: { limit: opts.limit, cursor: opts.cursor } });
  return res.json as { pages: ServerPage[]; nextCursor: string | null };
}

export interface VersionEntry {
  version: number;
  createdAt: string;
  title: string;
  current: boolean;
}

export async function apiVersions(base: string, apiKey: string, token: string): Promise<{ versions: VersionEntry[] }> {
  const res = await send(base, 'GET', `/api/v1/pages/${encodeURIComponent(token)}/versions`, { apiKey });
  return res.json as { versions: VersionEntry[] };
}

export async function apiDelete(base: string, apiKey: string, token: string, manageToken?: string): Promise<void> {
  await send(base, 'DELETE', `/api/v1/pages/${encodeURIComponent(token)}`, {
    apiKey,
    body: manageToken ? { manageToken } : undefined,
  });
}

export async function anonPublish(base: string, body: Record<string, unknown>): Promise<ServerPage> {
  const res = await send(base, 'POST', '/publish', { body });
  return res.json as ServerPage;
}

export async function anonEdit(base: string, token: string, body: Record<string, unknown>): Promise<ServerPage> {
  const res = await send(base, 'POST', `/p/${encodeURIComponent(token)}/edit`, { body });
  return res.json as ServerPage;
}

export async function anonDelete(base: string, token: string, manageToken: string): Promise<void> {
  await send(base, 'POST', `/p/${encodeURIComponent(token)}/delete`, { body: { manageToken } });
}

export async function getSource(base: string, token: string): Promise<SourcePage> {
  const res = await send(base, 'GET', `/p/${encodeURIComponent(token)}/source.json`);
  return res.json as SourcePage;
}

export interface Collection {
  slug: string;
  url: string;
  rawUrl?: string;
  title?: string;
  intro?: string;
  style?: string;
  sort?: string;
  pageCount?: number;
  pages?: ServerPage[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export async function apiCreateCollection(base: string, apiKey: string, body: Record<string, unknown>): Promise<Collection> {
  const res = await send(base, 'POST', '/api/v1/collections', { apiKey, body });
  return res.json as Collection;
}

export async function apiListCollections(
  base: string,
  apiKey: string,
): Promise<{ collections: Collection[]; [key: string]: unknown }> {
  const res = await send(base, 'GET', '/api/v1/collections', { apiKey });
  return res.json as { collections: Collection[]; [key: string]: unknown };
}

export async function apiGetCollection(base: string, apiKey: string, slug: string): Promise<Collection> {
  const res = await send(base, 'GET', `/api/v1/collections/${encodeURIComponent(slug)}`, { apiKey });
  return res.json as Collection;
}

export async function apiUpdateCollection(
  base: string,
  apiKey: string,
  slug: string,
  body: Record<string, unknown>,
): Promise<Collection> {
  const res = await send(base, 'PUT', `/api/v1/collections/${encodeURIComponent(slug)}`, { apiKey, body });
  return res.json as Collection;
}

export async function apiAddCollectionPage(
  base: string,
  apiKey: string,
  slug: string,
  body: Record<string, unknown>,
): Promise<Collection> {
  const res = await send(base, 'POST', `/api/v1/collections/${encodeURIComponent(slug)}/pages`, { apiKey, body });
  return res.json as Collection;
}

export async function apiRemoveCollectionPage(base: string, apiKey: string, slug: string, token: string): Promise<void> {
  await send(base, 'DELETE', `/api/v1/collections/${encodeURIComponent(slug)}/pages/${encodeURIComponent(token)}`, { apiKey });
}

export async function apiDeleteCollection(base: string, apiKey: string, slug: string): Promise<void> {
  await send(base, 'DELETE', `/api/v1/collections/${encodeURIComponent(slug)}`, { apiKey });
}
