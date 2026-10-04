import type { ResolvedConfig } from './config.js';
import { ApiError, UsageError } from './errors.js';
import {
  anonDelete,
  anonEdit,
  anonPublish,
  apiAddCollectionPage,
  apiCreateCollection,
  apiDelete,
  apiDeleteCollection,
  apiGet,
  apiGetCollection,
  apiList,
  apiListCollections,
  apiPublish,
  apiRemoveCollectionPage,
  apiUpdate,
  apiUpdateCollection,
  apiVersions,
  getSource,
} from './http.js';
import type { Collection, ServerPage, VersionEntry } from './http.js';
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
import { isValidName, resolveCollectionRef, resolvePageRef, resolvePageRefForServer } from './reference.js';

/**
 * Turns a page reference into the page's real token. A slug reference (a `BASE/<slug>`
 * link, or a bare slug this machine has no record of) is resolved by one keyed
 * `GET /api/v1/pages/<slug>`; everything else is already a token. Callers key
 * `pages.json` off the result, so a slug must never be stored as if it were a token.
 */
async function resolveToken(
  pageRef: string,
  ctx: ResolvedConfig,
  store: ReturnType<typeof loadPagesStore>,
): Promise<{ token: string; warning?: string }> {
  const resolved = resolvePageRef(pageRef, { base: ctx.url, store, hasKey: !!ctx.apiKey });
  if (resolved.isSlug && ctx.apiKey) {
    const meta = await apiGet(ctx.url, ctx.apiKey, resolved.token);
    if (typeof meta.token === 'string') return { token: meta.token, warning: resolved.warning };
  }
  return { token: resolved.token, warning: resolved.warning };
}

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
  slug?: string;
  collection?: string;
}

export interface UpdateOptions {
  title?: string;
  style?: string;
  baseVersion?: number;
  slug?: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function keyRequiredError(): UsageError {
  return new UsageError(
    'an API key is required for this operation (api_key_required); set MD_LANTERN_API_KEY or run "mdl config set-key"',
  );
}

/** Throws `keyRequiredError()` when no key is configured; otherwise returns the key. */
function requireKey(ctx: ResolvedConfig): string {
  if (!ctx.apiKey) throw keyRequiredError();
  return ctx.apiKey;
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
    slug: opts.slug,
    collection: opts.collection,
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
  if (opts.slug !== undefined) body.slug = opts.slug;

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

  // `token` may be a slug when resolved in key mode; the server always answers with the
  // page's real token, so remember the page under that, not under the slug.
  const realToken = typeof page.token === 'string' ? page.token : token;
  rememberUpdate(ctx, realToken, page, lookupByToken(store, ctx.url, realToken));

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
  if ((opts.slug !== undefined || opts.collection !== undefined) && !ctx.apiKey) throw keyRequiredError();
  const collection = opts.collection !== undefined ? resolveCollectionRef(opts.collection) : undefined;
  const pubOpts: PublishOptions = { ...opts, collection };

  if (pubOpts.name) return publishWithName(pubOpts.name, markdown, pubOpts, ctx);
  const page = await publishFresh(markdown, pubOpts, ctx);
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
  if (opts.slug !== undefined && !ctx.apiKey) throw keyRequiredError();
  const store = loadPagesStore(ctx.pagesFile);
  const { token, warning } = await resolveToken(pageRef, ctx, store);
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
  slug?: string | null;
  coverUrl?: string | null;
}

export interface GetOutcome {
  result: GetResult;
  warning?: string;
}

export async function get(pageRef: string, ctx: ResolvedConfig): Promise<GetOutcome> {
  const store = loadPagesStore(ctx.pagesFile);
  const resolved = resolvePageRef(pageRef, { base: ctx.url, store, hasKey: !!ctx.apiKey });
  let token = resolved.token;
  try {
    // `/p/:token/source.json` is token-only and does not resolve a slug; a key-mode slug
    // reference needs this extra keyed lookup first to learn the page's real token.
    let meta: ServerPage | undefined;
    if (ctx.apiKey && resolved.isSlug) {
      meta = await apiGet(ctx.url, ctx.apiKey, token);
      token = typeof meta.token === 'string' ? meta.token : token;
    }
    const source = await getSource(ctx.url, token);
    const url = typeof meta?.url === 'string' ? meta.url : `${ctx.url}/p/${token}`;
    return {
      result: {
        token: source.token,
        url,
        title: source.title,
        version: source.version,
        updatedAt: source.updatedAt,
        style: source.style,
        breaks: source.breaks,
        markdown: source.markdown,
        ...(meta?.slug !== undefined ? { slug: meta.slug as string | null } : {}),
        ...(meta?.coverUrl !== undefined ? { coverUrl: meta.coverUrl as string | null } : {}),
      },
      warning: resolved.warning,
    };
  } catch (err) {
    if (err instanceof ApiError && err.code === 'not_found') forgetToken(ctx, token);
    throw err;
  }
}

export async function setSlug(pageRef: string, slug: string | null, ctx: ResolvedConfig): Promise<UpdateResult> {
  const apiKey = requireKey(ctx);
  const store = loadPagesStore(ctx.pagesFile);
  const resolved = await resolveToken(pageRef, ctx, store);
  const page = await apiUpdate(ctx.url, apiKey, resolved.token, { slug });

  const realToken = typeof page.token === 'string' ? page.token : resolved.token;
  rememberUpdate(ctx, realToken, page, lookupByToken(store, ctx.url, realToken));

  const changed = page.changed !== false;
  return {
    result: {
      action: changed ? 'updated' : 'unchanged',
      changed,
      ...withoutManageToken(page),
    } as OperationResult,
    warning: resolved.warning,
  };
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
  const { token } = await resolveToken(pageRef, ctx, store);
  const res = await apiVersions(ctx.url, ctx.apiKey, token);
  return { versions: res.versions };
}

export interface RemoveOutcome {
  warning?: string;
}

export async function remove(pageRef: string, ctx: ResolvedConfig): Promise<RemoveOutcome> {
  const store = loadPagesStore(ctx.pagesFile);
  const { token, warning } = await resolveToken(pageRef, ctx, store);
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

export interface CreateCollectionOptions {
  slug: string;
  title: string;
  intro?: string;
  style?: string;
  sort?: string;
  pages?: string[];
}

export interface UpdateCollectionOptions {
  title?: string;
  intro?: string;
  style?: string;
  sort?: string;
  slug?: string;
  pages?: string[];
}

export async function createCollection(opts: CreateCollectionOptions, ctx: ResolvedConfig): Promise<Collection> {
  const apiKey = requireKey(ctx);
  const store = loadPagesStore(ctx.pagesFile);
  const pages = opts.pages?.map((ref) => resolvePageRefForServer(ref, { base: ctx.url, store }));
  return apiCreateCollection(ctx.url, apiKey, {
    slug: opts.slug,
    title: opts.title,
    intro: opts.intro,
    style: opts.style,
    sort: opts.sort,
    pages,
  });
}

export async function getCollection(colRef: string, ctx: ResolvedConfig): Promise<Collection> {
  const apiKey = requireKey(ctx);
  return apiGetCollection(ctx.url, apiKey, resolveCollectionRef(colRef));
}

export async function listCollections(ctx: ResolvedConfig): Promise<{ collections: Collection[]; [key: string]: unknown }> {
  const apiKey = requireKey(ctx);
  return apiListCollections(ctx.url, apiKey);
}

export async function updateCollection(
  colRef: string,
  opts: UpdateCollectionOptions,
  ctx: ResolvedConfig,
): Promise<Collection> {
  const apiKey = requireKey(ctx);
  const store = loadPagesStore(ctx.pagesFile);
  const pages = opts.pages?.map((ref) => resolvePageRefForServer(ref, { base: ctx.url, store }));
  return apiUpdateCollection(ctx.url, apiKey, resolveCollectionRef(colRef), {
    title: opts.title,
    intro: opts.intro,
    style: opts.style,
    sort: opts.sort,
    slug: opts.slug,
    pages,
  });
}

export async function addToCollection(
  colRef: string,
  pageRef: string,
  position: number | undefined,
  ctx: ResolvedConfig,
): Promise<Collection> {
  const apiKey = requireKey(ctx);
  const store = loadPagesStore(ctx.pagesFile);
  const page = resolvePageRefForServer(pageRef, { base: ctx.url, store });
  return apiAddCollectionPage(ctx.url, apiKey, resolveCollectionRef(colRef), { page, position });
}

export async function removeFromCollection(colRef: string, pageRef: string, ctx: ResolvedConfig): Promise<void> {
  const apiKey = requireKey(ctx);
  const store = loadPagesStore(ctx.pagesFile);
  // DELETE .../pages/<token> keys off the literal token, unlike the other collection
  // routes that accept any page-reference form.
  const { token } = await resolveToken(pageRef, { ...ctx, apiKey }, store);
  await apiRemoveCollectionPage(ctx.url, apiKey, resolveCollectionRef(colRef), token);
}

export async function deleteCollection(colRef: string, ctx: ResolvedConfig): Promise<void> {
  const apiKey = requireKey(ctx);
  await apiDeleteCollection(ctx.url, apiKey, resolveCollectionRef(colRef));
}
