#!/usr/bin/env node
import { readFileSync } from 'node:fs';

import type {
  CollectionArgs,
  ConfigArgs,
  GetArgs,
  ListArgs,
  PublishArgs,
  RmArgs,
  SlugArgs,
  UpdateArgs,
  VersionsArgs,
} from './core/args.js';
import { parseArgs } from './core/args.js';
import { maskKey, resolveConfig, setKey, setUrl, unsetKey } from './core/config.js';
import type { ResolvedConfig } from './core/config.js';
import { ApiError, UsageError, exitCodeFor } from './core/errors.js';
import * as ops from './core/operations.js';
import type { OperationResult } from './core/operations.js';
import { VERSION } from './core/version.js';

const HELP = `mdl — publish and manage markdown pages on an MD Lantern server

Usage:
  mdl [publish] [FILE|-] [--title T] [--style S] [--expires never|7d|30d] [--breaks] [--as NAME]
      [--slug SLUG] [--collection SLUG] [--json] [--url U]
  mdl update PAGE [FILE|-] [--title T] [--style S] [--base-version N] [--json]
  mdl get PAGE [--json]
  mdl list [--limit N] [--json]
  mdl versions PAGE [--json]
  mdl rm PAGE
  mdl slug PAGE SLUG | PAGE --clear
  mdl collection create SLUG --title T [--intro-file F] [--style S] [--sort manual|newest] [PAGE…]
  mdl collection add COLLECTION PAGE [--position N]
  mdl collection rm COLLECTION PAGE
  mdl collection get COLLECTION [--json]
  mdl collection list [--json]
  mdl collection update COLLECTION [--title T] [--intro-file F] [--style S] [--sort S] [--slug S]
  mdl collection delete COLLECTION
  mdl config show | set-key KEY | set-url URL | unset-key
  mdl --help | --version

With no FILE, publish/update read markdown from stdin.
Reads MD_LANTERN_URL and MD_LANTERN_API_KEY from the environment when --url is omitted.
Readable links (--slug) and collections require an API key.
`;

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function readInput(file: string | undefined): Promise<string> {
  if (file === undefined) {
    if (process.stdin.isTTY) {
      throw new UsageError('no input file given and stdin is a terminal; pass a file, "-", or pipe input');
    }
    return readStdin();
  }
  if (file === '-') return readStdin();
  return readFileSync(file, 'utf8');
}

function formatResultLabel(result: OperationResult): string {
  if (result.action === 'unchanged') return `No changes · v${result.version}`;
  const label = result.action === 'created' ? 'Published' : 'Updated';
  const title = typeof result.title === 'string' && result.title ? `«${result.title}» · ` : '';
  return `${label} ${title}v${result.version}`;
}

function printPublishResult(result: OperationResult, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else {
    process.stdout.write(`${result.url}\n`);
  }
  process.stderr.write(`${formatResultLabel(result)}\n`);
}

async function runPublish(parsed: PublishArgs, ctx: ResolvedConfig): Promise<void> {
  const input = await readInput(parsed.file);
  if (input.trim() === '') throw new UsageError('markdown is empty; nothing to publish');
  const result = await ops.publish(
    input,
    {
      title: parsed.title,
      style: parsed.style,
      expiresIn: parsed.expires,
      breaks: parsed.breaks,
      name: parsed.as,
      slug: parsed.slug,
      collection: parsed.collection,
    },
    ctx,
  );
  printPublishResult(result, parsed.json);
}

async function runUpdate(parsed: UpdateArgs, ctx: ResolvedConfig): Promise<void> {
  const input = await readInput(parsed.file);
  if (input.trim() === '') throw new UsageError('markdown is empty; nothing to publish');

  let baseVersion: number | undefined;
  if (parsed.baseVersion !== undefined) {
    baseVersion = Number(parsed.baseVersion);
    if (!Number.isInteger(baseVersion)) {
      throw new UsageError(`--base-version must be an integer, got "${parsed.baseVersion}"`);
    }
  }

  const { result, warning } = await ops.update(parsed.page, input, { title: parsed.title, style: parsed.style, baseVersion }, ctx);
  if (warning) process.stderr.write(`mdl: ${warning}\n`);
  printPublishResult(result, parsed.json);
}

async function runGet(parsed: GetArgs, ctx: ResolvedConfig): Promise<void> {
  const { result, warning } = await ops.get(parsed.page, ctx);
  if (warning) process.stderr.write(`mdl: ${warning}\n`);
  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else {
    process.stdout.write(result.markdown);
  }
}

function formatListLine(page: Record<string, unknown>): string {
  const url = typeof page.url === 'string' ? page.url : '';
  const title = typeof page.title === 'string' ? page.title : '';
  const version = typeof page.version === 'number' ? page.version : '';
  const when = typeof page.updatedAt === 'string' ? page.updatedAt : typeof page.createdAt === 'string' ? page.createdAt : '';
  const date = when ? when.slice(0, 10) : '';
  return `${url}  ${title}  v${version}  ${date}`;
}

async function runList(parsed: ListArgs, ctx: ResolvedConfig): Promise<void> {
  let limit: number | undefined;
  if (parsed.limit !== undefined) {
    limit = Number(parsed.limit);
    if (!Number.isInteger(limit)) throw new UsageError(`--limit must be an integer, got "${parsed.limit}"`);
  }
  const result = await ops.list({ limit }, ctx);
  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  const lines = result.pages.map(formatListLine);
  process.stdout.write(lines.length ? `${lines.join('\n')}\n` : '');
}

async function runVersions(parsed: VersionsArgs, ctx: ResolvedConfig): Promise<void> {
  const result = await ops.listVersions(parsed.page, ctx);
  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  const lines = result.versions.map((v) => `v${v.version}${v.current ? ' (current)' : ''}  ${v.title}  ${v.createdAt}`);
  process.stdout.write(lines.length ? `${lines.join('\n')}\n` : '');
}

async function runRemove(parsed: RmArgs, ctx: ResolvedConfig): Promise<void> {
  const { warning } = await ops.remove(parsed.page, ctx);
  if (warning) process.stderr.write(`mdl: ${warning}\n`);
}

async function runSlug(parsed: SlugArgs, ctx: ResolvedConfig): Promise<void> {
  const newSlug: string | null = parsed.clear ? null : parsed.slug ?? null;
  const { result, warning } = await ops.setSlug(parsed.page, newSlug, ctx);
  if (warning) process.stderr.write(`mdl: ${warning}\n`);
  process.stdout.write(`${String(result.url)}\n`);
}

function collectionPageUrl(page: unknown): string {
  const url = page && typeof page === 'object' ? (page as Record<string, unknown>).url : undefined;
  return typeof url === 'string' ? url : '';
}

async function runCollection(parsed: CollectionArgs, ctx: ResolvedConfig): Promise<void> {
  const p = parsed.positionals;
  const introText = (): string | undefined =>
    parsed.introFile !== undefined ? readFileSync(parsed.introFile, 'utf8') : undefined;

  switch (parsed.action) {
    case 'create': {
      const slug = p[0];
      if (slug === undefined) throw new UsageError('collection create requires a SLUG argument');
      if (!parsed.title) throw new UsageError('collection create requires --title');
      const meta = await ops.createCollection(
        { slug, title: parsed.title, intro: introText(), style: parsed.style, sort: parsed.sort, pages: p.slice(1) },
        ctx,
      );
      process.stdout.write(`${String(meta.url)}\n`);
      return;
    }
    case 'add': {
      const [colRef, page] = p;
      if (colRef === undefined || page === undefined) {
        throw new UsageError('collection add requires COLLECTION and PAGE arguments');
      }
      let position: number | undefined;
      if (parsed.position !== undefined) {
        position = Number(parsed.position);
        if (!Number.isInteger(position)) throw new UsageError(`--position must be an integer, got "${parsed.position}"`);
      }
      const meta = await ops.addToCollection(colRef, page, position, ctx);
      process.stdout.write(`${String(meta.url)}\n`);
      return;
    }
    case 'rm': {
      const [colRef, page] = p;
      if (colRef === undefined || page === undefined) {
        throw new UsageError('collection rm requires COLLECTION and PAGE arguments');
      }
      await ops.removeFromCollection(colRef, page, ctx);
      return;
    }
    case 'get': {
      const colRef = p[0];
      if (colRef === undefined) throw new UsageError('collection get requires a COLLECTION argument');
      const meta = await ops.getCollection(colRef, ctx);
      if (parsed.json) {
        process.stdout.write(`${JSON.stringify(meta)}\n`);
        return;
      }
      const pages = Array.isArray(meta.pages) ? meta.pages : [];
      const lines = [String(meta.url), ...pages.map(collectionPageUrl)];
      process.stdout.write(`${lines.join('\n')}\n`);
      return;
    }
    case 'list': {
      const res = await ops.listCollections(ctx);
      if (parsed.json) {
        process.stdout.write(`${JSON.stringify(res)}\n`);
        return;
      }
      const lines = (res.collections || []).map((c) => String(c.url));
      process.stdout.write(lines.length ? `${lines.join('\n')}\n` : '');
      return;
    }
    case 'update': {
      const colRef = p[0];
      if (colRef === undefined) throw new UsageError('collection update requires a COLLECTION argument');
      const meta = await ops.updateCollection(
        colRef,
        { title: parsed.title, intro: introText(), style: parsed.style, sort: parsed.sort, slug: parsed.slug },
        ctx,
      );
      process.stdout.write(`${String(meta.url)}\n`);
      return;
    }
    case 'delete': {
      const colRef = p[0];
      if (colRef === undefined) throw new UsageError('collection delete requires a COLLECTION argument');
      await ops.deleteCollection(colRef, ctx);
      return;
    }
  }
}

function runConfig(parsed: ConfigArgs): void {
  const configDir = resolveConfig({ env: process.env }).configDir;
  if (parsed.action === 'show') {
    const resolved = resolveConfig({ env: process.env });
    process.stdout.write(`url: ${resolved.url} (${resolved.urlSource})\n`);
    process.stdout.write(`apiKey: ${maskKey(resolved.apiKey)} (${resolved.apiKeySource})\n`);
    process.stdout.write(`configDir: ${resolved.configDir}\n`);
    return;
  }
  if (parsed.action === 'set-key') {
    if (!parsed.value) throw new UsageError('config set-key requires a KEY argument');
    setKey(configDir, parsed.value);
    return;
  }
  if (parsed.action === 'set-url') {
    if (!parsed.value) throw new UsageError('config set-url requires a URL argument');
    setUrl(configDir, parsed.value);
    return;
  }
  unsetKey(configDir);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const parsed = parseArgs(argv);

  if (parsed.command === 'version') {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  if (parsed.command === 'help') {
    process.stdout.write(HELP);
    return;
  }
  if (parsed.command === 'config') {
    runConfig(parsed);
    return;
  }

  const ctx = resolveConfig({ cliUrl: parsed.url, env: process.env });

  switch (parsed.command) {
    case 'publish':
      return runPublish(parsed, ctx);
    case 'update':
      return runUpdate(parsed, ctx);
    case 'get':
      return runGet(parsed, ctx);
    case 'list':
      return runList(parsed, ctx);
    case 'versions':
      return runVersions(parsed, ctx);
    case 'rm':
      return runRemove(parsed, ctx);
    case 'slug':
      return runSlug(parsed, ctx);
    case 'collection':
      return runCollection(parsed, ctx);
  }
}

function reportError(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof ApiError) {
    process.stderr.write(`mdl: ${message} (${err.code})\n`);
  } else {
    process.stderr.write(`mdl: ${message}\n`);
  }
  process.exitCode = exitCodeFor(err);
}

main().catch(reportError);
