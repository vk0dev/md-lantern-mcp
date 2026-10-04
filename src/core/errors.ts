export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly extra: Record<string, unknown>;

  constructor(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export function exitCodeFor(err: unknown): number {
  if (err instanceof ApiError) return 2;
  if (err instanceof NetworkError) return 3;
  return 1;
}

/**
 * Maps a server/client error code to an actionable message. Codes come from the
 * API.md Errors table, plus a couple of client-only codes (key_required,
 * manage_token_required) for situations the server never sees.
 */
export function describeApiError(code: string, extra: Record<string, unknown> = {}): string {
  switch (code) {
    case 'unauthorized':
      return 'the API key is missing or invalid; check MD_LANTERN_API_KEY or run "mdl config set-key"';
    case 'markdown_required':
      return 'markdown is empty; provide non-empty markdown';
    case 'bad_expires_in':
      return 'expiresIn must be one of never, 7d, or 30d';
    case 'bad_style':
      return 'style must be one of clean, book, docs, paper, or mono';
    case 'bad_json':
      return 'the request body was not valid JSON';
    case 'too_large':
      return 'the markdown is too large for this server; shorten it';
    case 'bad_base_version':
      return "baseVersion must be a positive integer matching the page's current version";
    case 'version_conflict': {
      const current = extra.currentVersion;
      return current !== undefined
        ? `the page is now at version ${current}, re-read and retry`
        : 'the page changed since you last read it; re-read and retry';
    }
    case 'forbidden':
      return "this key cannot edit or delete this page; use the owning key or the page's manage token";
    case 'bad_manage_token':
      return 'the manage token is missing or incorrect for this page';
    case 'not_found':
      return 'the page does not exist, has expired, or was already deleted';
    case 'gone':
      return 'the page has expired and no longer exists';
    case 'storage_full':
      return "the server's storage is full; wait for expiry cleanup or ask the operator to raise limits";
    case 'rate_limited': {
      const retryAfter = extra.retryAfter;
      return retryAfter !== undefined
        ? `rate limited; retry after ${retryAfter}s`
        : 'rate limited; back off and retry later';
    }
    case 'key_required':
      return 'this operation requires an API key (set MD_LANTERN_API_KEY or run "mdl config set-key")';
    case 'manage_token_required':
      return 'no manage token known for this page on this machine; publish it from here first';
    case 'bad_slug':
      return 'the slug is invalid: 3-60 lowercase letters/digits/hyphens, no leading/trailing/double hyphen, and not a reserved word';
    case 'slug_taken':
      return 'that slug is already in use by another page or collection; choose a different one';
    case 'collection_not_found':
      return 'that collection does not exist; check the slug or collection URL';
    case 'title_required':
      return 'a non-empty title is required';
    case 'bad_intro':
      return 'intro must be a markdown string';
    case 'bad_sort':
      return 'sort must be one of manual or newest';
    case 'bad_pages':
      return 'one of the given pages could not be resolved; check the token, URL, or slug';
    default:
      return `request failed with ${code}`;
  }
}
