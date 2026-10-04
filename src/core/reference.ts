import { UsageError } from './errors.js';
import { lookupByName, lookupByToken } from './pagesStore.js';
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
  hasKey?: boolean;
}

export interface ResolvedRef {
  token: string;
  warning?: string;
  isSlug?: boolean;
}

const URL_TOKEN_PATTERN = /^(https?:\/\/[^/]+)\/p\/([A-Za-z0-9_-]{8,64})(?:[./].*)?$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const URL_SLUG_PATTERN = /^(https?:\/\/[^/]+)\/([a-z0-9][a-z0-9-]*)(?:\.md)?$/;

/** Strips `.md`, `/history`, `/v/<n>`, `/v/<n>.md`, `/v/<n>/changes`, query and hash suffixes. */
function extractTokenFromUrl(raw: string): { origin: string; token: string } | null {
  const withoutHash = raw.split('#')[0] ?? raw;
  const withoutQuery = withoutHash.split('?')[0] ?? withoutHash;
  const match = URL_TOKEN_PATTERN.exec(withoutQuery);
  if (!match) return null;
  return { origin: match[1], token: match[2] };
}

/** Strips an optional `.md` suffix, query and hash from a single-segment `BASE/<slug>` link. */
function extractSlugFromUrl(raw: string): { origin: string; slug: string } | null {
  const withoutHash = raw.split('#')[0] ?? raw;
  const withoutQuery = withoutHash.split('?')[0] ?? withoutHash;
  const match = URL_SLUG_PATTERN.exec(withoutQuery);
  if (!match) return null;
  return { origin: match[1], slug: match[2] };
}

/**
 * Resolves a CLI/MCP page reference to a token. Order matters: a name bound in
 * pages.json takes priority over treating the same string as a bare token, because a
 * valid name (e.g. "daily-report") also matches the bare-token shape.
 */
export function resolvePageRef(arg: string, { base, store, hasKey }: ResolveRefInput): ResolvedRef {
  if (/^https?:\/\//.test(arg) || arg.includes('/p/')) {
    const parsed = extractTokenFromUrl(arg);
    if (parsed) {
      const warning =
        parsed.origin === base
          ? undefined
          : `page URL origin ${parsed.origin} differs from the configured server ${base}; using ${base}`;
      return { token: parsed.token, warning };
    }

    const slugParsed = extractSlugFromUrl(arg);
    if (slugParsed) {
      const warning =
        slugParsed.origin === base
          ? undefined
          : `page URL origin ${slugParsed.origin} differs from the configured server ${base}; using ${base}`;
      if (hasKey) return { token: slugParsed.slug, isSlug: true, warning };

      const withoutHash = arg.split('#')[0] ?? arg;
      const withoutQuery = withoutHash.split('?')[0] ?? withoutHash;
      const canonical = withoutQuery.replace(/\.md$/, '');
      const byUrl = store.pages.find((p) => p.base === base && p.url === canonical);
      if (byUrl) return { token: byUrl.token };
      throw new UsageError(
        `cannot resolve page reference without an API key: ${arg} (publish it from here or set MD_LANTERN_API_KEY)`,
      );
    }

    throw new UsageError(`cannot resolve page reference: ${arg}`);
  }

  const byName = lookupByName(store, base, arg);
  if (byName) return { token: byName.token };

  // A bare string this machine has no record of may be a page slug rather than a token
  // (both shapes overlap). With a key, flag it so the caller asks the server, which
  // tries it as a token first and as a slug second, and gets the real token back.
  if (hasKey && SLUG_PATTERN.test(arg) && !lookupByToken(store, base, arg)) return { token: arg, isSlug: true };

  if (isBareToken(arg)) return { token: arg };

  throw new UsageError(`cannot resolve page reference: ${arg}`);
}

/** Resolves a collection reference (a bare slug or a `BASE/<slug>` URL) to a slug. */
export function resolveCollectionRef(arg: string): string {
  if (/^https?:\/\//.test(arg)) {
    const parsed = extractSlugFromUrl(arg);
    if (!parsed) throw new UsageError(`cannot resolve collection reference: ${arg}`);
    return parsed.slug;
  }
  return arg;
}

/**
 * Resolves a page reference the server will receive (e.g. in a collection's `pages`
 * array): a locally bound name becomes its token; anything else (token, `/p/` URL,
 * slug URL) is passed through unchanged for the server to resolve itself.
 */
export function resolvePageRefForServer(arg: string, { base, store }: ResolveRefInput): string {
  const byName = lookupByName(store, base, arg);
  return byName ? byName.token : arg;
}
