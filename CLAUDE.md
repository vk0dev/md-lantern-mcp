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

## Publishing
- See [PUBLISHING.md](./PUBLISHING.md) for full marketplace playbook
- Version sync: `package.json`, `.claude-plugin/plugin.json`, `server.json`, `src/createServer.ts`
- Release: `git tag -a vX.Y.Z && git push --follow-tags` → CI publishes everywhere

## Architecture
- `src/createServer.ts` — McpServer factory, exports `createServer()` and `createSandboxServer()` (Smithery)
- `src/server.ts` — CLI/stdio entry point, uses `createServer()`
- `src/tools/` — MCP tools registration
- `src/cli.ts` — standalone CLI entry point
