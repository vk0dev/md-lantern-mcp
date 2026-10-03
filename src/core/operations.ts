import type { ResolvedConfig } from './config.js';
import { ApiError, UsageError } from './errors.js';
import {
  anonDelete,
  anonEdit,
  anonPublish,
  apiDelete,
  apiList,
  apiPublish,
  apiUpdate,
  apiVersions,
  getSource,
} from './http.js';
import type { ServerPage, VersionEntry } from './http.js';
import {
  forget,
  loadPagesStore,
  lookupByName,
  lookupByToken,
  recordPublish,
  savePagesStore,
  stripManageToken,
} from './pagesStore.js';
import type { PageEntry } from './pagesStore.js';
import { isValidName, resolvePageRef } from './reference.js';

export type Action = 'created' | 'updated' | 'unchanged';

export interface OperationResult extends Record<string, unknown> {
  action: Action;
  changed: boolean;
  token: string;
  url: string;
  version: number;
}

export interface PublishOptions {
  title?: string;
  style?: string;
  expiresIn?: string;
  breaks?: boolean;
  name?: string;
}

export interface UpdateOptions {
  title?: string;
  style?: string;
  baseVersion?: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function withoutManageToken<T extends Record<string, unknown>>(obj: T): Omit<T, 'manageToken'> {
  const { manageToken: _manageToken, ...rest } = obj as Record<string, unknown>;
  return rest as Omit<T, 'manageToken'>;
}

function rememberPublish(ctx: ResolvedConfig, page: ServerPage, name?: string): void {
  const store = loadPagesStore(ctx.pagesFile);
  const existing = lookupByToken(store, ctx.url, page.token);
  const entry: PageEntry = {
    base: ctx.url,
    token: page.token,
    url: page.url,
    title: typeof page.title === 'string' ? page.title : existing?.title,
    manageToken: typeof page.manageToken === 'string' ? page.manageToken : existing?.manageToken,
    name: name ?? existing?.name,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: existing ? nowIso() : undefined,
  };
  savePagesStore(ctx.pagesFile, recordPublish(store, entry));
}

function rememberUpdate(ctx: ResolvedConfig, token: string, page: ServerPage, existing: PageEntry | undefined): void {
  const store = loadPagesStore(ctx.pagesFile);
  const entry: PageEntry = {
    base: ctx.url,
    token,
    url: typeof page.url === 'string' ? page.url : existing?.url ?? `${ctx.url}/p/${token}`,
    title: typeof page.title === 'string' ? page.title : existing?.title,
    manageToken: existing?.manageToken,
    name: existing?.name,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
  savePagesStore(ctx.pagesFile, recordPublish(store, entry));
}

function forgetToken(ctx: ResolvedConfig, token: string): void {
  const store = loadPagesStore(ctx.pagesFile);
  savePagesStore(ctx.pagesFile, forget(store, ctx.url, token));
}

function publishBody(markdown: string, opts: PublishOptions): Record<string, unknown> {
  return {
    markdown,
    title: opts.title,
    expiresIn: opts.expiresIn,
    breaks: opts.breaks,
    style: opts.style,
  };
}

async function publishFresh(markdown: string, opts: PublishOptions, ctx: ResolvedConfig): Promise<ServerPage> {
  const body = publishBody(markdown, opts);
  return ctx.apiKey ? apiPublish(ctx.url, ctx.apiKey, body) : anonPublish(ctx.url, body);
}

/** Core edit path shared by `update()` and the "same name again" branch of `publish()`. */
async function updateToken(
  token: string,
  markdown: string,
  opts: UpdateOptions,
  ctx: ResolvedConfig,
): Promise<OperationResult> {
  const store = loadPagesStore(ctx.pagesFile);
  const entry = lookupByToken(store, ctx.url, token);

  const body: Record<string, unknown> = { markdown };
  if (opts.title !== undefined) body.title = opts.title;
  if (opts.style !== undefined) body.style = opts.style;
  if (opts.baseVersion !== undefined) body.baseVersion = opts.baseVersion;

  let page: ServerPage;
  if (ctx.apiKey) {
    if (entry?.manageToken) body.manageToken = entry.manageToken;
    page = await apiUpdate(ctx.url, ctx.apiKey, token, body);
  } else {
    if (!entry?.manageToken) {
      throw new ApiError(0, 'manage_token_required', describeManageTokenRequired());
    }
    body.manageToken = entry.manageToken;
    page = await anonEdit(ctx.url, token, body);
  }

  rememberUpdate(ctx, token, page, entry);

  const changed = page.changed !== false;
  return {
    action: changed ? 'updated' : 'unchanged',
    changed,
    ...withoutManageToken(page),
  } as OperationResult;
}

function describeManageTokenRequired(): string {
  return 'no manage token known for this page on this machine; publish it from here first';
}

async function publishWithName(
  name: string,
  markdown: string,
  opts: PublishOptions,
  ctx: ResolvedConfig,
): Promise<OperationResult> {
  if (!isValidName(name)) {
    throw new UsageError(`invalid name "${name}": must match ^[a-z0-9][a-z0-9._-]{0,63}$`);
  }

  const store = loadPagesStore(ctx.pagesFile);
  const existing = lookupByName(store, ctx.url, name);

  if (existing) {
    try {
      return await updateToken(existing.token, markdown, opts, ctx);
    } catch (err) {
      if (!(err instanceof ApiError && err.code === 'not_found')) throw err;
      forgetToken(ctx, existing.token);
      // fall through: the bound page is gone server-side; publish fresh and re-bind.
    }
  }

  const page = await publishFresh(markdown, opts, ctx);
  rememberPublish(ctx, page, name);

  return {
    action: 'created',
    changed: true,
    ...withoutManageToken(page),
  } as OperationResult;
}

export async function publish(markdown: string, opts: PublishOptions, ctx: ResolvedConfig): Promise<OperationResult> {
  if (opts.name) return publishWithName(opts.name, markdown, opts, ctx);
  const page = await publishFresh(markdown, opts, ctx);
  rememberPublish(ctx, page);
  return {
    action: 'created',
    changed: true,
    ...withoutManageToken(page),
  } as OperationResult;
}

export interface UpdateResult {
  result: OperationResult;
  warning?: string;
}

export async function update(
  pageRef: string,
  markdown: string,
  opts: UpdateOptions,
  ctx: ResolvedConfig,
): Promise<UpdateResult> {
  const store = loadPagesStore(ctx.pagesFile);
  const { token, warning } = resolvePageRef(pageRef, { base: ctx.url, store });
  try {
    const result = await updateToken(token, markdown, opts, ctx);
    return { result, warning };
  } catch (err) {
    if (err instanceof ApiError && err.code === 'not_found') forgetToken(ctx, token);
    throw err;
  }
}

export interface GetResult extends Record<string, unknown> {
  token: string;
  url: string;
  title: string;
  version: number;
  updatedAt: string | null;
  style: string;
  breaks: boolean;
  markdown: string;
}

export interface GetOutcome {
  result: GetResult;
  warning?: string;
}

export async function get(pageRef: string, ctx: ResolvedConfig): Promise<GetOutcome> {
  const store = loadPagesStore(ctx.pagesFile);
  const { token, warning } = resolvePageRef(pageRef, { base: ctx.url, store });
  try {
    const source = await getSource(ctx.url, token);
    return {
      result: {
        token: source.token,
        url: `${ctx.url}/p/${token}`,
        title: source.title,
        version: source.version,
        updatedAt: source.updatedAt,
        style: source.style,
        breaks: source.breaks,
        markdown: source.markdown,
      },
      warning,
    };
  } catch (err) {
    if (err instanceof ApiError && err.code === 'not_found') forgetToken(ctx, token);
    throw err;
  }
}

export interface ListOptions {
  limit?: number;
  cursor?: string;
}

export interface ListResult extends Record<string, unknown> {
  pages: Array<Record<string, unknown>>;
  nextCursor?: string | null;
}

export async function list(opts: ListOptions, ctx: ResolvedConfig): Promise<ListResult> {
  if (ctx.apiKey) {
    const res = await apiList(ctx.url, ctx.apiKey, opts);
    return { pages: res.pages, nextCursor: res.nextCursor };
  }
  const store = loadPagesStore(ctx.pagesFile);
  const pages = store.pages.filter((p) => p.base === ctx.url).map(stripManageToken);
  return { pages };
}

export interface VersionsResult extends Record<string, unknown> {
  versions: VersionEntry[];
}

export async function listVersions(pageRef: string, ctx: ResolvedConfig): Promise<VersionsResult> {
  if (!ctx.apiKey) {
    throw new ApiError(0, 'key_required', 'listing versions requires an API key (set MD_LANTERN_API_KEY or run "mdl config set-key")');
  }
  const store = loadPagesStore(ctx.pagesFile);
  const { token } = resolvePageRef(pageRef, { base: ctx.url, store });
  const res = await apiVersions(ctx.url, ctx.apiKey, token);
  return { versions: res.versions };
}

export interface RemoveOutcome {
  warning?: string;
}

export async function remove(pageRef: string, ctx: ResolvedConfig): Promise<RemoveOutcome> {
  const store = loadPagesStore(ctx.pagesFile);
  const { token, warning } = resolvePageRef(pageRef, { base: ctx.url, store });
  const entry = lookupByToken(store, ctx.url, token);
  try {
    if (ctx.apiKey) {
      await apiDelete(ctx.url, ctx.apiKey, token, entry?.manageToken);
    } else {
      if (!entry?.manageToken) {
        throw new ApiError(0, 'manage_token_required', describeManageTokenRequired());
      }
      await anonDelete(ctx.url, token, entry.manageToken);
    }
    forgetToken(ctx, token);
    return { warning };
  } catch (err) {
    if (err instanceof ApiError && err.code === 'not_found') forgetToken(ctx, token);
    throw err;
  }
}
