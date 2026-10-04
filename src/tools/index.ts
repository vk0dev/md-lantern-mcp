import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { resolveConfig } from '../core/config.js';
import type { ResolvedConfig } from '../core/config.js';
import { ApiError, NetworkError, UsageError } from '../core/errors.js';
import * as ops from '../core/operations.js';

const STYLE_ENUM = z.enum(['clean', 'book', 'docs', 'paper', 'mono']);
const EXPIRES_ENUM = z.enum(['never', '7d', '30d']);

const PAGE_RESULT_SHAPE = {
  url: z.string().optional(),
  token: z.string().optional(),
  rawUrl: z.string().optional(),
  historyUrl: z.string().optional(),
  version: z.number().optional(),
  updatedAt: z.string().nullable().optional(),
  title: z.string().optional(),
  style: z.string().optional(),
  action: z.string().optional(),
  changed: z.boolean().optional(),
  ok: z.boolean().optional(),
  slug: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
};

const COLLECTION_RESULT_SHAPE = {
  apiVersion: z.number().optional(),
  slug: z.string().optional(),
  url: z.string().optional(),
  rawUrl: z.string().optional(),
  title: z.string().optional(),
  intro: z.string().optional(),
  style: z.string().optional(),
  sort: z.string().optional(),
  pageCount: z.number().optional(),
  pages: z.array(z.any()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
};

function buildContext(): ResolvedConfig {
  return resolveConfig({ env: process.env });
}

function errorCodeFor(err: unknown): string {
  if (err instanceof ApiError) return err.code;
  if (err instanceof UsageError) return 'usage_error';
  if (err instanceof NetworkError) return 'network_error';
  return 'unknown_error';
}

function errorResult(err: unknown): { isError: true; content: Array<{ type: 'text'; text: string }> } {
  const code = errorCodeFor(err);
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true,
    content: [{ type: 'text', text: `md-lantern error ${code}: ${message}` }],
  };
}

function textContent(lines: string[]): Array<{ type: 'text'; text: string }> {
  return [{ type: 'text', text: lines.join('\n') }];
}

export function registerTools(server: McpServer): void {
  server.registerTool(
    'publish_markdown',
    {
      description:
        'Publishes markdown as a shareable page with a permanent URL; use when a report, table, log, or ' +
        'code-heavy answer is too long to paste inline and needs a link to share in chat or revisit later.',
      inputSchema: {
        markdown: z.string().describe('The markdown document to publish.'),
        title: z.string().optional().describe('Explicit title; derived from the markdown front matter or first heading when omitted.'),
        style: STYLE_ENUM.optional().describe('Reading style for the page: clean (default), book, docs, paper, or mono.'),
        expires_in: EXPIRES_ENUM.optional().describe('Expiration: never (default), 7d, or 30d.'),
        breaks: z.boolean().optional().describe('When true, a single newline breaks the line (GFM line breaks).'),
        name: z
          .string()
          .optional()
          .describe('Stable local name to reuse the same page on a later call (e.g. a recurring status report) instead of creating a new link.'),
        slug: z
          .string()
          .optional()
          .describe('Readable link in place of the permanent token URL: the page is served at BASE/<slug>. Requires an API key.'),
        collection: z
          .string()
          .optional()
          .describe('Slug or URL of an existing collection to append this page to as its newest member. Requires an API key.'),
      },
      outputSchema: PAGE_RESULT_SHAPE,
    },
    async (input) => {
      try {
        const ctx = buildContext();
        const result = await ops.publish(
          input.markdown,
          {
            title: input.title,
            style: input.style,
            expiresIn: input.expires_in,
            breaks: input.breaks,
            name: input.name,
            slug: input.slug,
            collection: input.collection,
          },
          ctx,
        );
        return {
          content: textContent([String(result.url), `${result.action} · v${result.version}`]),
          structuredContent: result,
        };
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'update_page',
    {
      description:
        'Edits an existing published page in place, keeping its URL and recording the previous text in its ' +
        'public history; use to correct or refresh a page you already published instead of creating a duplicate.',
      inputSchema: {
        page: z.string().describe('The page token, page URL, or local name to update.'),
        markdown: z.string().describe('The new markdown content.'),
        title: z.string().optional().describe('New explicit title; omit to keep deriving it from the markdown.'),
        style: STYLE_ENUM.optional().describe('Reading style for the page: clean, book, docs, paper, or mono.'),
        base_version: z
          .number()
          .int()
          .optional()
          .describe('Expected current version for optimistic concurrency; omit for last-write-wins.'),
        slug: z
          .string()
          .nullable()
          .optional()
          .describe('Readable link to set (BASE/<slug>), or null to clear it back to the permanent token URL. Requires an API key.'),
      },
      outputSchema: PAGE_RESULT_SHAPE,
    },
    async (input) => {
      try {
        const ctx = buildContext();
        const { result } = await ops.update(
          input.page,
          input.markdown,
          { title: input.title, style: input.style, baseVersion: input.base_version, slug: input.slug },
          ctx,
        );
        return {
          content: textContent([String(result.url), `${result.action} · v${result.version}`]),
          structuredContent: result,
        };
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'get_page',
    {
      description:
        'Reads back the current markdown and metadata of a published page by token, URL, or local name; use ' +
        'before editing a page, or to hand its exact content to another agent without re-fetching the chat history.',
      inputSchema: {
        page: z.string().describe('The page token, page URL, or local name to read.'),
      },
      outputSchema: {
        ...PAGE_RESULT_SHAPE,
        markdown: z.string().optional(),
        breaks: z.boolean().optional(),
      },
    },
    async (input) => {
      try {
        const ctx = buildContext();
        const { result } = await ops.get(input.page, ctx);
        return {
          content: textContent([result.url, `v${result.version}`]),
          structuredContent: result,
        };
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'list_pages',
    {
      description:
        'Lists pages published by this API key, or locally remembered anonymous pages, with their URLs, ' +
        'titles and versions; use to find an existing page to update instead of publishing a duplicate.',
      inputSchema: {
        limit: z.number().int().optional().describe('Maximum number of pages to return (server default 50, max 200).'),
        cursor: z.string().optional().describe("Pagination cursor from a previous call's nextCursor field."),
      },
      outputSchema: {
        pages: z.array(z.any()).optional(),
        nextCursor: z.string().nullable().optional(),
      },
    },
    async (input) => {
      try {
        const ctx = buildContext();
        const result = await ops.list({ limit: input.limit, cursor: input.cursor }, ctx);
        return {
          content: textContent([`${result.pages.length} page(s)`]),
          structuredContent: result,
        };
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'delete_page',
    {
      description:
        'Permanently deletes a published page by token, URL, or local name; use to remove a page that is no ' +
        'longer needed, was published by mistake, or should stop being shared.',
      inputSchema: {
        page: z.string().describe('The page token, page URL, or local name to delete.'),
      },
      outputSchema: {
        ok: z.boolean().optional(),
      },
    },
    async (input) => {
      try {
        const ctx = buildContext();
        await ops.remove(input.page, ctx);
        return {
          content: textContent(['deleted']),
          structuredContent: { ok: true },
        };
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'list_versions',
    {
      description:
        'Lists every kept version of a published page, newest first, with its timestamp and title; use to find ' +
        'which past version to compare against or restore before making another edit.',
      inputSchema: {
        page: z.string().describe('The page token, page URL, or local name whose version history to list.'),
      },
      outputSchema: {
        versions: z.array(z.any()).optional(),
      },
    },
    async (input) => {
      try {
        const ctx = buildContext();
        const result = await ops.listVersions(input.page, ctx);
        return {
          content: textContent([`${result.versions.length} version(s)`]),
          structuredContent: result,
        };
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'create_collection',
    {
      description:
        'Creates a named collection that gathers pages under one shareable URL and keeps their display order; use it to start a recurring report stream or a multi-part document before publishing or adding pages into it.',
      inputSchema: {
        slug: z.string().describe('Readable link for the collection: it is served at BASE/<slug>.'),
        title: z.string().describe('The collection title shown on its public page.'),
        intro: z.string().optional().describe("Markdown rendered as the collection's intro text."),
        style: STYLE_ENUM.optional().describe('Reading style for the collection page: clean (default), book, docs, paper, or mono.'),
        sort: z
          .enum(['manual', 'newest'])
          .optional()
          .describe("Member order: manual (the order added/arranged, default) or newest (each page's own date, newest first)."),
        pages: z
          .array(z.string())
          .optional()
          .describe('Initial member pages, in order; each a page token, URL, or local name.'),
      },
      outputSchema: COLLECTION_RESULT_SHAPE,
    },
    async (input) => {
      try {
        const ctx = buildContext();
        const meta = await ops.createCollection(
          { slug: input.slug, title: input.title, intro: input.intro, style: input.style, sort: input.sort, pages: input.pages },
          ctx,
        );
        return {
          content: textContent([String(meta.url), `created · ${String(meta.pageCount ?? 0)} page(s)`]),
          structuredContent: meta,
        };
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'get_collection',
    {
      description:
        'Reads a collection and lists its member pages in display order, each with its own URL; use to check what is already in a report stream or guide before adding to it or publishing the next entry.',
      inputSchema: {
        collection: z.string().describe('The collection slug or collection URL to read.'),
      },
      outputSchema: COLLECTION_RESULT_SHAPE,
    },
    async (input) => {
      try {
        const ctx = buildContext();
        const meta = await ops.getCollection(input.collection, ctx);
        return {
          content: textContent([String(meta.url), `${String(meta.pageCount ?? 0)} page(s)`]),
          structuredContent: meta,
        };
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'list_collections',
    {
      description:
        'Lists every collection this API key created, with its URL and page count but not its member pages; use to find an existing collection to publish or add into instead of creating a duplicate one.',
      inputSchema: {},
      outputSchema: {
        apiVersion: z.number().optional(),
        collections: z.array(z.any()).optional(),
      },
    },
    async (_input) => {
      try {
        const ctx = buildContext();
        const result = await ops.listCollections(ctx);
        return {
          content: textContent([`${(result.collections || []).length} collection(s)`]),
          structuredContent: result,
        };
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'update_collection',
    {
      description:
        'Updates a collection title, intro, style, sort order, or slug, and can replace its page order wholesale; use to rename a collection, restyle it, or rearrange a multi-part document.',
      inputSchema: {
        collection: z.string().describe('The collection slug or collection URL to update.'),
        title: z.string().optional().describe('New title.'),
        intro: z.string().optional().describe('New intro markdown, replacing it wholesale.'),
        style: STYLE_ENUM.optional().describe('New reading style: clean, book, docs, paper, or mono.'),
        sort: z.enum(['manual', 'newest']).optional().describe('New member order: manual or newest.'),
        slug: z.string().optional().describe('New readable link; the old one keeps redirecting to it.'),
        pages: z
          .array(z.string())
          .optional()
          .describe('Replaces the member list and its order entirely; each entry a page token, URL, or local name.'),
      },
      outputSchema: COLLECTION_RESULT_SHAPE,
    },
    async (input) => {
      try {
        const ctx = buildContext();
        const meta = await ops.updateCollection(
          input.collection,
          { title: input.title, intro: input.intro, style: input.style, sort: input.sort, slug: input.slug, pages: input.pages },
          ctx,
        );
        return {
          content: textContent([String(meta.url), `updated · ${String(meta.pageCount ?? 0)} page(s)`]),
          structuredContent: meta,
        };
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'add_to_collection',
    {
      description:
        'Adds one page to a collection, appended at the end or inserted at a given position; use to insert a page into an existing report stream or multi-part guide without recreating the collection.',
      inputSchema: {
        collection: z.string().describe('The collection slug or collection URL to add the page to.'),
        page: z.string().describe('The page token, page URL, or local name to add.'),
        position: z.number().int().optional().describe('0-based insert index; omit to append at the end.'),
      },
      outputSchema: COLLECTION_RESULT_SHAPE,
    },
    async (input) => {
      try {
        const ctx = buildContext();
        const meta = await ops.addToCollection(input.collection, input.page, input.position, ctx);
        return {
          content: textContent([String(meta.url), `${String(meta.pageCount ?? 0)} page(s)`]),
          structuredContent: meta,
        };
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'remove_from_collection',
    {
      description:
        'Removes one page from a collection without deleting the page itself, which stays reachable at its own link; use to drop an entry from a report stream or multi-part guide.',
      inputSchema: {
        collection: z.string().describe('The collection slug or collection URL to remove the page from.'),
        page: z.string().describe('The page token, page URL, or local name to remove.'),
      },
      outputSchema: {
        ok: z.boolean().optional(),
      },
    },
    async (input) => {
      try {
        const ctx = buildContext();
        await ops.removeFromCollection(input.collection, input.page, ctx);
        return {
          content: textContent(['removed']),
          structuredContent: { ok: true },
        };
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'delete_collection',
    {
      description:
        'Permanently deletes a collection and frees its slug, leaving every member page untouched and reachable at its own link; use when a report stream or multi-part guide is no longer needed.',
      inputSchema: {
        collection: z.string().describe('The collection slug or collection URL to delete.'),
      },
      outputSchema: {
        ok: z.boolean().optional(),
      },
    },
    async (input) => {
      try {
        const ctx = buildContext();
        await ops.deleteCollection(input.collection, ctx);
        return {
          content: textContent(['deleted']),
          structuredContent: { ok: true },
        };
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
