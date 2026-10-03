import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  bindName,
  forget,
  loadPagesStore,
  lookupByName,
  lookupByToken,
  recordPublish,
  savePagesStore,
  stripManageToken,
} from '../src/core/pagesStore.js';
import type { PageEntry } from '../src/core/pagesStore.js';

const BASE = 'http://127.0.0.1:4000';

function entry(overrides: Partial<PageEntry> = {}): PageEntry {
  return {
    base: BASE,
    token: 'AbCdEfGh1234',
    url: `${BASE}/p/AbCdEfGh1234`,
    title: 'Hi',
    manageToken: 'secret-manage-token',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('pagesStore pure functions', () => {
  it('recordPublish appends a new entry and replaces an existing (base, token) entry', () => {
    const store = recordPublish({ version: 1, pages: [] }, entry());
    expect(store.pages).toHaveLength(1);

    const updated = recordPublish(store, entry({ title: 'Hi, edited' }));
    expect(updated.pages).toHaveLength(1);
    expect(updated.pages[0].title).toBe('Hi, edited');
  });

  it('lookupByToken and lookupByName find entries scoped by base', () => {
    const store = recordPublish({ version: 1, pages: [] }, entry({ name: 'daily-report' }));
    expect(lookupByToken(store, BASE, 'AbCdEfGh1234')?.token).toBe('AbCdEfGh1234');
    expect(lookupByToken(store, 'http://other', 'AbCdEfGh1234')).toBeUndefined();
    expect(lookupByName(store, BASE, 'daily-report')?.token).toBe('AbCdEfGh1234');
    expect(lookupByName(store, BASE, 'missing')).toBeUndefined();
  });

  it('bindName sets the name on the matching entry only', () => {
    const store = recordPublish({ version: 1, pages: [] }, entry());
    const bound = bindName(store, BASE, 'daily-report', 'AbCdEfGh1234');
    expect(lookupByName(bound, BASE, 'daily-report')?.token).toBe('AbCdEfGh1234');
  });

  it('forget removes the matching (base, token) entry', () => {
    const store = recordPublish({ version: 1, pages: [] }, entry());
    const forgotten = forget(store, BASE, 'AbCdEfGh1234');
    expect(forgotten.pages).toHaveLength(0);
  });

  it('stripManageToken removes the manage token field', () => {
    const stripped = stripManageToken(entry());
    expect(stripped).not.toHaveProperty('manageToken');
    expect(stripped.token).toBe('AbCdEfGh1234');
  });
});

describe('pagesStore file round-trip', () => {
  it('writes and reads back pages.json, with mode 0600 on POSIX', () => {
    if (process.platform === 'win32') return;
    const dir = mkdtempSync(path.join(os.tmpdir(), 'mdl-pages-'));
    const file = path.join(dir, 'pages.json');

    savePagesStore(file, recordPublish({ version: 1, pages: [] }, entry()));

    const mode = statSync(file).mode;
    expect(mode & 0o077).toBe(0);

    const loaded = loadPagesStore(file);
    expect(loaded.pages).toHaveLength(1);
    expect(loaded.pages[0].token).toBe('AbCdEfGh1234');
    expect(JSON.parse(readFileSync(file, 'utf8')).version).toBe(1);
  });

  it('returns an empty store for a missing or corrupt file', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'mdl-pages-'));
    expect(loadPagesStore(path.join(dir, 'missing.json')).pages).toEqual([]);
  });
});
