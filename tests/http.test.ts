import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, NetworkError, exitCodeFor } from '../src/core/errors.js';
import { apiList, apiUpdate } from '../src/core/http.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('http error mapping', () => {
  it('maps a 409 response to ApiError("version_conflict") carrying currentVersion', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'version_conflict', currentVersion: 3 }), { status: 409 })),
    );

    await expect(apiUpdate('http://127.0.0.1:1', 'mdl_key', 'TOKEN1234', { markdown: '# x\n' })).rejects.toMatchObject({
      status: 409,
      code: 'version_conflict',
      extra: { currentVersion: 3 },
    });
  });

  it('maps a 429 response to ApiError("rate_limited") with retryAfter from the RateLimit header', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'rate_limited' }), {
            status: 429,
            headers: { RateLimit: 'limit=200, remaining=0, reset=42' },
          }),
      ),
    );

    let caught: unknown;
    try {
      await apiList('http://127.0.0.1:1', 'mdl_key', {});
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe('rate_limited');
    expect((caught as ApiError).extra.retryAfter).toBe(42);
    expect(exitCodeFor(caught)).toBe(2);
  });

  it('prefers the Retry-After header when present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'rate_limited' }), {
            status: 429,
            headers: { 'Retry-After': '5' },
          }),
      ),
    );
    try {
      await apiList('http://127.0.0.1:1', 'mdl_key', {});
      expect.unreachable('expected apiList to reject');
    } catch (err) {
      expect((err as ApiError).extra.retryAfter).toBe(5);
    }
  });

  it('wraps a fetch rejection in NetworkError, mapped to exit code 3', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );

    let caught: unknown;
    try {
      await apiList('http://127.0.0.1:1', 'mdl_key', {});
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(NetworkError);
    expect(exitCodeFor(caught)).toBe(3);
  });
});
