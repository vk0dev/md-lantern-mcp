import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { atomicWriteFile, ensureConfigDir } from './config.js';

export interface PageEntry {
  base: string;
  token: string;
  url: string;
  title?: string;
  manageToken?: string;
  name?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PagesStoreData {
  version: 1;
  pages: PageEntry[];
}

export function emptyPagesStore(): PagesStoreData {
  return { version: 1, pages: [] };
}

export function loadPagesStore(file: string): PagesStoreData {
  if (!existsSync(file)) return emptyPagesStore();
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<PagesStoreData>;
    if (Array.isArray(parsed.pages)) return { version: 1, pages: parsed.pages };
  } catch {
    // fall through to an empty store on corrupt/unreadable JSON
  }
  return emptyPagesStore();
}

export function savePagesStore(file: string, store: PagesStoreData): void {
  ensureConfigDir(path.dirname(file));
  atomicWriteFile(file, JSON.stringify(store, null, 2) + '\n');
}

/** Replaces any existing entry for the same (base, token), or appends a new one. */
export function recordPublish(store: PagesStoreData, entry: PageEntry): PagesStoreData {
  const pages = store.pages.filter((p) => !(p.base === entry.base && p.token === entry.token));
  pages.push(entry);
  return { version: 1, pages };
}

export function lookupByToken(store: PagesStoreData, base: string, token: string): PageEntry | undefined {
  return store.pages.find((p) => p.base === base && p.token === token);
}

export function lookupByName(store: PagesStoreData, base: string, name: string): PageEntry | undefined {
  return store.pages.find((p) => p.base === base && p.name === name);
}

export function bindName(store: PagesStoreData, base: string, name: string, token: string): PagesStoreData {
  const pages = store.pages.map((p) => (p.base === base && p.token === token ? { ...p, name } : p));
  return { version: 1, pages };
}

export function forget(store: PagesStoreData, base: string, token: string): PagesStoreData {
  return { version: 1, pages: store.pages.filter((p) => !(p.base === base && p.token === token)) };
}

export function listByBase(store: PagesStoreData, base: string): PageEntry[] {
  return store.pages.filter((p) => p.base === base);
}

export function stripManageToken(entry: PageEntry): Omit<PageEntry, 'manageToken'> {
  const { manageToken: _manageToken, ...rest } = entry;
  return rest;
}
