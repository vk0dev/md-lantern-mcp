# md-lantern-mcp

## Stack
- TypeScript, `@modelcontextprotocol/sdk`, Zod
- Vitest for unit tests

## Commands
- Install: `npm ci`
- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`
- Smoke test: `npm run smoke`
- Operator acceptance (real MD Lantern server on a loopback port): `npm run build && node scripts/acceptance.mjs`
- Operator acceptance for readable links/collections (needs an MD Lantern checkout with collections, i.e. `MDL_REPO=<path>`): `npm run build && MDL_REPO=<path> node scripts/acceptance-1.1.mjs`

## Publishing
- See [PUBLISHING.md](./PUBLISHING.md) for full marketplace playbook
- Version sync: `package.json`, `.claude-plugin/plugin.json`, `server.json`, `src/createServer.ts`
- Release: `git tag -a vX.Y.Z && git push --follow-tags` → CI publishes everywhere

## Architecture
- `src/createServer.ts` — McpServer factory, exports `createServer()` and `createSandboxServer()` (Smithery)
- `src/server.ts` — stdio entry point (bin `md-lantern-mcp`), uses `createServer()`
- `src/cli.ts` — `mdl` CLI entry point (bin `mdl`): parses argv, builds config, calls `src/core/operations.ts`
- `src/tools/index.ts` — registers 13 MCP tools: `publish_markdown`, `update_page`, `get_page`, `list_pages`, `delete_page`, `list_versions`, and the 7 collection tools `create_collection`, `get_collection`, `list_collections`, `update_collection`, `add_to_collection`, `remove_from_collection`, `delete_collection`
- `src/core/` — shared logic used by both bins:
  - `version.ts` — runtime version read from `package.json`
  - `errors.ts` — `UsageError`/`ApiError`/`NetworkError`, exit-code mapping, error-code → message text
  - `config.ts` — URL/API-key precedence, `config.json` read/write (atomic, mode 0600/0700)
  - `pagesStore.ts` — local `pages.json` memory (manage tokens, name bindings), shared by the CLI and MCP server
  - `reference.ts` — resolves a page token/URL/name (or, in key mode, a readable-link URL) into a token; also `resolveCollectionRef`/`resolvePageRefForServer` for collection references
  - `http.ts` — HTTP client for MD Lantern's key and anonymous routes, plus the collections endpoints
  - `operations.ts` — publish/update/get/list/versions/remove, slug set/clear, and the 7 collection operations, choosing the key or anonymous path
  - `args.ts` — pure argv parser for `mdl`
