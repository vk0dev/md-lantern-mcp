import { UsageError } from './errors.js';
import { lookupByName } from './pagesStore.js';
import type { PagesStoreData } from './pagesStore.js';

export const NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export function isValidName(value: string): boolean {
  return NAME_PATTERN.test(value);
}

export function isBareToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

export interface ResolveRefInput {
  base: string;
  store: PagesStoreData;
}

export interface ResolvedRef {
  token: string;
  warning?: string;
}

const URL_TOKEN_PATTERN = /^(https?:\/\/[^/]+)\/p\/([A-Za-z0-9_-]{8,64})(?:[./].*)?$/;

/** Strips `.md`, `/history`, `/v/<n>`, `/v/<n>.md`, `/v/<n>/changes`, query and hash suffixes. */
function extractTokenFromUrl(raw: string): { origin: string; token: string } | null {
  const withoutHash = raw.split('#')[0] ?? raw;
  const withoutQuery = withoutHash.split('?')[0] ?? withoutHash;
  const match = URL_TOKEN_PATTERN.exec(withoutQuery);
  if (!match) return null;
  return { origin: match[1], token: match[2] };
}

/**
 * Resolves a CLI/MCP page reference to a token. Order matters: a name bound in
 * pages.json takes priority over treating the same string as a bare token, because a
 * valid name (e.g. "daily-report") also matches the bare-token shape.
 */
export function resolvePageRef(arg: string, { base, store }: ResolveRefInput): ResolvedRef {
  if (/^https?:\/\//.test(arg) || arg.includes('/p/')) {
    const parsed = extractTokenFromUrl(arg);
    if (!parsed) throw new UsageError(`cannot resolve page reference: ${arg}`);
    const warning =
      parsed.origin === base
        ? undefined
        : `page URL origin ${parsed.origin} differs from the configured server ${base}; using ${base}`;
    return { token: parsed.token, warning };
  }

  const byName = lookupByName(store, base, arg);
  if (byName) return { token: byName.token };

  if (isBareToken(arg)) return { token: arg };

  throw new UsageError(`cannot resolve page reference: ${arg}`);
}
