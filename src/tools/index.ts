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
      },
      outputSchema: PAGE_RESULT_SHAPE,
    },
    async (input) => {
      try {
        const ctx = buildContext();
        const result = await ops.publish(
          input.markdown,
          { title: input.title, style: input.style, expiresIn: input.expires_in, breaks: input.breaks, name: input.name },
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
      },
      outputSchema: PAGE_RESULT_SHAPE,
    },
    async (input) => {
      try {
        const ctx = buildContext();
        const { result } = await ops.update(
          input.page,
          input.markdown,
          { title: input.title, style: input.style, baseVersion: input.base_version },
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
}
