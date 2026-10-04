import { describe, expect, it } from 'vitest';

import { UsageError } from '../src/core/errors.js';
import type { PagesStoreData } from '../src/core/pagesStore.js';
import { resolveCollectionRef, resolvePageRef } from '../src/core/reference.js';

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

  it('resolves a slug URL as a slug when a key is available', () => {
    const result = resolvePageRef(`${BASE}/kak-rabotaem`, { base: BASE, store: storeWith(), hasKey: true });
    expect(result).toMatchObject({ token: 'kak-rabotaem', isSlug: true });
  });

  it('resolves a .md slug URL as a slug when a key is available', () => {
    const result = resolvePageRef(`${BASE}/kak-rabotaem.md`, { base: BASE, store: storeWith(), hasKey: true });
    expect(result).toMatchObject({ token: 'kak-rabotaem', isSlug: true });
  });

  it('warns on a cross-origin slug URL with a key', () => {
    const result = resolvePageRef('https://other.example/kak-rabotaem', { base: BASE, store: storeWith(), hasKey: true });
    expect(result).toMatchObject({ token: 'kak-rabotaem', isSlug: true });
    expect(result.warning).toMatch(/differs/);
  });

  it('resolves a slug URL from the local store without a key', () => {
    const store = storeWith([{ token: 'AbCdEfGh1234', url: `${BASE}/kak-rabotaem` }]);
    const result = resolvePageRef(`${BASE}/kak-rabotaem`, { base: BASE, store, hasKey: false });
    expect(result.token).toBe('AbCdEfGh1234');
    expect(result.isSlug).toBeUndefined();
  });

  it('throws UsageError for an unmatched slug URL without a key', () => {
    expect(() => resolvePageRef(`${BASE}/kak-rabotaem`, { base: BASE, store: storeWith(), hasKey: false })).toThrow(UsageError);
  });
});

describe('resolveCollectionRef', () => {
  it('returns a bare slug unchanged', () => {
    expect(resolveCollectionRef('my-collection')).toBe('my-collection');
  });

  it('extracts the slug from a collection URL', () => {
    expect(resolveCollectionRef(`${BASE}/my-collection`)).toBe('my-collection');
  });

  it('extracts the slug from a .md collection URL', () => {
    expect(resolveCollectionRef(`${BASE}/my-collection.md`)).toBe('my-collection');
  });

  it('throws UsageError for an unresolvable collection URL', () => {
    expect(() => resolveCollectionRef(`${BASE}/p/AbCdEfGh1234`)).toThrow(UsageError);
  });
});
