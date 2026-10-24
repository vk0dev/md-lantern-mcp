# Publishing Playbook

How to release updates and manage marketplace presence for `@vk0/md-lantern-mcp`.
This document is for **any agent** (Claude Code, Cursor, Cline, or manual).

---

## Releasing an update

```bash
# 1. Version bump — syncs 4 places (package.json, .claude-plugin/plugin.json,
#    server.json, src/createServer.ts):
npm run version-sync X.Y.Z

# 2. Update CHANGELOG.md

# 3. Verify
npm run build && npm test && npm run lint && npm run smoke && npm run release-check

# 4. Commit + tag + push
git add -A
git commit -m "chore: release vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin main --follow-tags
```

Pushing the tag starts `publish.yml`, which re-runs the gates (version sync, tag equals
`package.json` version, lint, build, tests, smoke, `release-check`) and only then publishes.

## What the pipeline does

| Target | Mechanism | Needs |
|--------|-----------|-------|
| **npm** | `publish.yml` on tag `v*`: `npm publish --access public --provenance` | `NPM_TOKEN` secret, `id-token: write` (provenance) |
| **GitHub Release** | `publish.yml` (generated notes) | — |
| **GitHub Pages** | `pages.yml` deploys `docs/` on changes to `docs/**` | Pages enabled once, source "GitHub Actions" |
| **Official MCP Registry** | `publish.yml` via `mcp-publisher login github-oidc` | no secret (GitHub OIDC); the step is `continue-on-error` |
| **Post-release verify** | `scripts/post-release-verify.mjs` checks npm, Registry and Pages | fails the workflow if a target did not land |

Smithery is **not** published by CI. A listing for a stdio npm server is created once,
manually, at smithery.ai (OAuth). `post-release-verify` only checks it as a warning, and
only when the optional `SMITHERY_API_KEY` secret is set.

Directories such as PulseMCP, Glama, MseeP and MCPServers.org may pick the package up
from the Official MCP Registry or npm on their own. There is no guarantee and no fixed
delay; check them by hand and submit manually if a listing does not appear.

## First release setup (owner actions)

These steps need the repository owner; an agent stops and asks.

1. Create the public repository `vk0dev/md-lantern-mcp` and push (provenance requires a
   public repository).
2. Create a granular **automation** token on npmjs.com that can publish the `@vk0`
   scope, and add it in GitHub → Settings → Secrets as `NPM_TOKEN`. Enter it by hand;
   do not script it from a local file.
3. Enable GitHub Pages: Settings → Pages → Source: **GitHub Actions**, before the first
   `pages.yml` run (`pages.yml` can also be started via `workflow_dispatch`).
4. Optional: add repository topics (`mcp`, `mcp-server`, `claude-code`, `anthropic`,
   `developer-tools`).
5. Marketplace first submissions (manual): Awesome MCP Servers (fork + PR), mcp.so and
   Smithery (forms with GitHub OAuth).

The Official MCP Registry namespace `io.github.vk0dev` is authenticated by GitHub OIDC
from this repository's workflow; no secret is needed.

## Version sync locations

1. `package.json` → `"version"`
2. `.claude-plugin/plugin.json` → `"version"`
3. `server.json` → `"version"` (two places: root + packages[0])
4. `src/createServer.ts` → `version:` string

## GitHub Secrets

| Secret | Required | Source |
|--------|----------|--------|
| `NPM_TOKEN` | yes | npmjs.com → Access Tokens (granular automation token) |
| `SMITHERY_API_KEY` | no | smithery.ai → Account → API Keys; only used for the warn-only Smithery check in `post-release-verify` |
