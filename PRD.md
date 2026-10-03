# md-lantern-mcp — PRD

**Status: draft**
**Owner:** vk0
**Date:** 2026-10-04

## Problem

An agent (or a human scripting one) frequently produces markdown output that is too
long, too tabular, or too code-heavy to paste into a chat turn — a report, a diff
summary, a log excerpt, generated docs. Pasting it inline floods the conversation,
can't be unfurled as a link in Telegram/Slack, and has no stable address the agent (or
a teammate) can come back to or edit in place. There is no agent-native client for
MD Lantern — a self-hosted markdown publishing server that already solves the hosting
side of this — so every integration re-implements the same HTTP calls.

## North Star

An agent reaches for `publish_markdown` (or pipes into `mdl`) as naturally as it writes
to a file, and gets back one durable, shareable link instead of a wall of markdown in
the transcript.

## Scope

### In scope (v1.0)

- `mdl` CLI: publish, update, get, list, versions, rm, config.
- `md-lantern-mcp` stdio MCP server: `publish_markdown`, `update_page`, `get_page`,
  `list_pages`, `delete_page`, `list_versions`.
- Key-authenticated and anonymous publishing against any MD Lantern instance.
- Local page memory shared between the CLI and the MCP server (name bindings, manage
  tokens for anonymous ownership).
- Page reference resolution by token, URL, or local name.

### Out of scope

- Hosting or operating an MD Lantern server itself (this package is a client only).
- Multi-instance page memory merging, or syncing `pages.json` across machines.
- A GUI or TUI; this is a CLI + MCP server.
- Workspace/file-sync features that MD Lantern's browser composer has (login, cabinet,
  live file watching) — those are server/browser features, not API-key operations.

## Success Metrics

- `node scripts/acceptance.mjs` passes end-to-end against a real MD Lantern server.
- An agent client (e.g. Claude Code) can publish, update, and read back a page via the
  MCP tools without the operator writing any glue code.

## Risks

- **API drift**: `docs/API.md` on the MD Lantern side documents only the seven
  `/api/v1` Bearer routes; the anonymous browser routes (`/publish`, `/p/:token/edit`,
  `/p/:token/delete`, `/p/:token/source.json`) are undocumented there and were read
  directly from `server.js`. A future MD Lantern release could change those without a
  corresponding API.md update.
- **Manage-token loss**: anonymous ownership lives only in `pages.json` on the
  publishing machine; losing that file (or publishing from a different machine) means
  the page can no longer be edited or deleted without a server-side API key.
- **Public by default**: every published page is readable by anyone with its URL; the
  tools do nothing to stop an agent from publishing something that shouldn't be public.
