# Publishing Playbook

How to release updates and manage marketplace presence for `@vk0/md-lantern-mcp`.
This document is for **any agent** (Claude Code, OpenClaw, Cursor, Cline, or manual).

---

## Releasing an update

```bash
# 1. Version bump — sync in 4 places:
#    package.json, .claude-plugin/plugin.json, server.json, src/createServer.ts

# 2. Update CHANGELOG.md

# 3. Verify
npm run build && npm test && npm run lint && npm run smoke

# 4. Commit + tag + push
git add -A
git commit -m "chore: release vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin main --follow-tags
```

CI does the rest: npm publish, GitHub Release, Official MCP Registry, Smithery.

## What updates automatically

| Platform | Mechanism | Delay |
|----------|-----------|-------|
| **npm** | CI `publish.yml` on tag `v*` | ~1 min |
| **GitHub Release** | CI auto | ~1 min |
| **GitHub Pages** | CI `pages.yml` | ~2 min |
| **Official MCP Registry** | CI `publish.yml` step | ~1 min |
| **Smithery** | CI `publish.yml` step | ~1 min |
| **PulseMCP** | Auto from Registry | 1-7 days |
| **Glama / MseeP / MCPServers.org** | Auto-scraping npm | 24-48h |

**Manual steps: ZERO.** Push tag → everything updates.

## First release setup

```bash
# One-time setup for a new project:
gh repo create vk0dev/md-lantern-mcp --public --source=. --push
gh secret set NPM_TOKEN --repo vk0dev/md-lantern-mcp --body $(grep _authToken ~/.npmrc | cut -d= -f2)
gh secret set SMITHERY_API_KEY --repo vk0dev/md-lantern-mcp --body <smithery-key>
gh api repos/vk0dev/md-lantern-mcp/pages -X POST -f build_type=workflow
gh api repos/vk0dev/md-lantern-mcp/topics -X PUT \
  -f "names[]=mcp" -f "names[]=mcp-server" -f "names[]=claude-code" \
  -f "names[]=anthropic" -f "names[]=developer-tools"

# Marketplace first submissions:
# - Awesome MCP Servers: fork + PR via gh CLI
# - mcp.so: submit form (GitHub OAuth)
# - Others: auto-discovery from npm keywords
```

## Version sync locations

1. `package.json` → `"version"`
2. `.claude-plugin/plugin.json` → `"version"`
3. `server.json` → `"version"` (two places: root + packages[0])
4. `src/createServer.ts` → `version:` string

## Required GitHub Secrets

| Secret | Source |
|--------|--------|
| `NPM_TOKEN` | `~/.npmrc` or npmjs.com → Access Tokens |
| `SMITHERY_API_KEY` | smithery.ai → Account → API Keys |

## Required GitHub Variables

| Variable | Value |
|----------|-------|
| `SMITHERY_SERVER_NAME` | `unfucker/md-lantern-mcp` (your Smithery namespace/name) |
