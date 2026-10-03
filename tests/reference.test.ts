import { describe, expect, it } from 'vitest';

import { UsageError } from '../src/core/errors.js';
import type { PagesStoreData } from '../src/core/pagesStore.js';
import { resolvePageRef } from '../src/core/reference.js';

const BASE = 'http://127.0.0.1:4000';

function storeWith(entries: Partial<PagesStoreData['pages'][number]>[] = []): PagesStoreData {
  return {
    version: 1,
    pages: entries.map((e) => ({
      base: BASE,
      token: 'AbCdEfGh1234',
      url: `${BASE}/p/AbCdEfGh1234`,
      createdAt: new Date().toISOString(),
      ...e,
    })),
  };
}

describe('resolvePageRef', () => {
  it('resolves a bare token', () => {
    const result = resolvePageRef('AbCdEfGh1234', { base: BASE, store: storeWith() });
    expect(result.token).toBe('AbCdEfGh1234');
    expect(result.warning).toBeUndefined();
  });

  it('resolves a plain page URL', () => {
    const result = resolvePageRef(`${BASE}/p/AbCdEfGh1234`, { base: BASE, store: storeWith() });
    expect(result.token).toBe('AbCdEfGh1234');
  });

  it.each([
    [`${BASE}/p/AbCdEfGh1234.md`],
    [`${BASE}/p/AbCdEfGh1234/history`],
    [`${BASE}/p/AbCdEfGh1234/v/3`],
    [`${BASE}/p/AbCdEfGh1234/v/3.md`],
    [`${BASE}/p/AbCdEfGh1234/v/3/changes`],
    [`${BASE}/p/AbCdEfGh1234?foo=bar`],
    [`${BASE}/p/AbCdEfGh1234#section`],
  ])('strips the %s suffix down to the token', (url) => {
    const result = resolvePageRef(url, { base: BASE, store: storeWith() });
    expect(result.token).toBe('AbCdEfGh1234');
  });

  it('warns but still resolves when the URL origin differs from the configured base', () => {
    const result = resolvePageRef('https://other.example/p/AbCdEfGh1234', { base: BASE, store: storeWith() });
    expect(result.token).toBe('AbCdEfGh1234');
    expect(result.warning).toMatch(/differs from the configured server/);
  });

  it('prefers a bound name over treating the same string as a bare token', () => {
    const store = storeWith([{ token: 'ZzZzZzZzZzZz', name: 'daily-report' }]);
    const result = resolvePageRef('daily-report', { base: BASE, store });
    expect(result.token).toBe('ZzZzZzZzZzZz');
  });

  it('falls back to a bare token when no name matches', () => {
    const result = resolvePageRef('ZzZzZzZzZzZz', { base: BASE, store: storeWith() });
    expect(result.token).toBe('ZzZzZzZzZzZz');
  });

  it('throws UsageError for unresolvable garbage', () => {
    expect(() => resolvePageRef('not a reference!', { base: BASE, store: storeWith() })).toThrow(UsageError);
    expect(() => resolvePageRef('short', { base: BASE, store: storeWith() })).toThrow(UsageError);
  });
});
