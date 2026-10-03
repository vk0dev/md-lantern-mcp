# mcp-project-template

Starter template for building MCP servers under the `@vk0` scope. Batteries included: CI/CD, auto-publish to 9 marketplaces, agent-friendly README structure, Smithery compatibility.

**Live example:** [`agent-cost-mcp`](https://github.com/vk0dev/agent-cost-mcp) — built from this template.

## Quick start

```bash
# Option 1: GitHub template
gh repo create vk0dev/my-new-mcp --template vk0dev/mcp-project-template --clone
cd my-new-mcp

# Option 2: degit
npx degit vk0dev/mcp-project-template my-new-mcp
cd my-new-mcp
git init && git add -A && git commit -m "init from template"
```

## After cloning

### 1. Replace placeholders

Find and replace these in all files:

| Placeholder | Replace with | Example |
|-------------|-------------|---------|
| `md-lantern-mcp` | Your project name (npm-safe) | `my-cool-mcp` |
| `Publish markdown from your AI agent or shell as a clean page with a permanent link on an MD Lantern server. MCP server plus the mdl CLI.` | One-line description (≤100 chars for MCP Registry) | `Analyze git blame patterns to find knowledge silos` |

```bash
# Quick sed replacement (macOS):
find . -type f -not -path './.git/*' -not -path './node_modules/*' \
  -exec sed -i '' 's/md-lantern-mcp/my-cool-mcp/g; s/Publish markdown from your AI agent or shell as a clean page with a permanent link on an MD Lantern server. MCP server plus the mdl CLI./Your description here/g' {} +
```

### 2. Install and verify

```bash
npm install
npm run build
npm test
npm run smoke   # MCP client smoke test
```

### 3. Build your tools

Replace `src/tools/hello.ts` with your actual MCP tools. Update `src/createServer.ts` to import them.

### 4. Prepare for v1.0.0

Before first public release, complete these:

- [ ] Replace hello-world tool with real tools
- [ ] Write tests for your tools
- [ ] Update README with Why/Install/Tools/Example/FAQ sections
- [ ] Create README translations (ja, zh-CN, ru, es)
- [ ] Create `docs/index.html` landing page
- [ ] Create `docs/og-image.png` social preview
- [ ] Update PRD.md (status: approved)
- [ ] Bump version to `1.0.0` in 4 places
- [ ] Add `[1.0.0]` entry to CHANGELOG.md

### 5. Publish

```bash
# One-time setup
gh repo create vk0dev/<name> --public --source=. --push
gh secret set NPM_TOKEN --repo vk0dev/<name> --body $(grep _authToken ~/.npmrc | cut -d= -f2)
gh secret set SMITHERY_API_KEY --repo vk0dev/<name> --body <your-smithery-key>
gh api repos/vk0dev/<name>/pages -X POST -f build_type=workflow

# Release
git tag -a v1.0.0 -m "v1.0.0"
git push origin main --follow-tags
# → CI: npm + GitHub Release + MCP Registry + Smithery — all automatic
```

See [PUBLISHING.md](./PUBLISHING.md) for the full playbook.

## What's included

| File | Purpose |
|------|---------|
| `src/createServer.ts` | McpServer factory + `createSandboxServer` (Smithery) |
| `src/server.ts` | Stdio entry point |
| `src/cli.ts` | Standalone CLI |
| `src/tools/hello.ts` | Example tool (replace with yours) |
| `.github/workflows/ci.yml` | Test matrix Node 18/20/22 |
| `.github/workflows/publish.yml` | Auto-publish: npm + Release + MCP Registry + Smithery |
| `.github/workflows/pages.yml` | GitHub Pages deploy |
| `server.json` | Official MCP Registry manifest |
| `.claude-plugin/plugin.json` | Claude Code plugin metadata |
| `PUBLISHING.md` | Release playbook for any agent |
| `CLAUDE.md` | Development notes |
| `PRD.md` | Product requirements skeleton |

## Philosophy: agent-as-buyer

The target "buyer" of any MCP server is not a human directly — it's the user's AI agent. The agent searches npm/GitHub/marketplaces, reads metadata → README → decides to install.

Everything in this template is optimized for that flow:
- README starts with "Why/When to use" (trigger phrases for embedding match)
- Install snippets for 4 clients (Claude Desktop, Claude Code, Cursor, Cline)
- Tool descriptions ≥80 chars (MCP Registry requirement)
- 10+ npm keywords for marketplace auto-scraping
- `server.json` for Official MCP Registry submission

## License

[MIT](./LICENSE) © vk0.dev
