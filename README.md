# md-lantern-mcp

Publish markdown as a shareable page with a permanent link, from an AI agent or a shell —
instead of pasting a wall of text into chat.

## Why / When to use

Reach for this the moment you'd otherwise paste a long report, a wide table, a log dump,
or a code-heavy answer directly into a conversation. Typical triggers:

- "share a long report as a link" instead of flooding the chat with markdown
- "publish markdown" that someone else (human or agent) needs to open later
- "send a link instead of a wall of text" when the output would blow past a reasonable
  message length
- building an **agent status page** — a recurring report (daily status, build summary,
  incident log) that should live at one stable URL and just get updated in place

If the content needs to be read back verbatim by another agent, revisited later, shared
in Telegram/Slack, or kept as a durable artifact instead of scrolling history, publish it
and hand over the URL.

## What it is

[MD Lantern](https://github.com/vk0dev) is a small, self-hostable markdown publishing
server (an instance might live at `md.vk0.dev`, or on your own infrastructure). This
package is the agent-facing client for it:

- **One link, everywhere** — the page URL unfurls as a rich card in Telegram, Slack, and
  most chat apps, and renders as a normal web page in a browser.
- **A `.md` twin for the next agent** — every page also serves its raw markdown
  (`<url>.md`), read back byte-for-byte by `mdl get` or the `get_page` tool, no scraping
  required.
- **Edit in place, with public history** — updating a page keeps its URL working; the
  text it replaces is kept as a version in the page's public history, so nothing is
  silently lost.

This package ships two bins from one package:

- `md-lantern-mcp` — a stdio MCP server exposing 6 tools to any MCP-capable agent client.
- `mdl` — a standalone CLI for shells and scripts.

Both talk to the same MD Lantern HTTP API and share the same local page memory, so a page
published from the CLI can be updated from the MCP server (or vice versa) on the same
machine.

## Quick start

```bash
# with an API key (recommended — lets you list and inspect version history)
export MD_LANTERN_URL=https://md.vk0.dev
export MD_LANTERN_API_KEY=mdl_...

echo '# Hello\n\nFrom mdl.' | mdl
# -> https://md.vk0.dev/p/AbCdEfGh1234

# no key at all also works (anonymous publish, same flow the browser composer uses)
cat report.md | mdl
```

## Install

### Claude Code

```bash
claude mcp add md-lantern-mcp -- npx -y @vk0/md-lantern-mcp
```

Or add it to `.mcp.json`:

```json
{
  "mcpServers": {
    "md-lantern-mcp": {
      "command": "npx",
      "args": ["-y", "@vk0/md-lantern-mcp"],
      "env": { "MD_LANTERN_URL": "https://md.vk0.dev", "MD_LANTERN_API_KEY": "mdl_..." }
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "md-lantern-mcp": {
      "command": "npx",
      "args": ["-y", "@vk0/md-lantern-mcp"],
      "env": { "MD_LANTERN_URL": "https://md.vk0.dev", "MD_LANTERN_API_KEY": "mdl_..." }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "md-lantern-mcp": {
      "command": "npx",
      "args": ["-y", "@vk0/md-lantern-mcp"],
      "env": { "MD_LANTERN_URL": "https://md.vk0.dev", "MD_LANTERN_API_KEY": "mdl_..." }
    }
  }
}
```

### Cline

Add to Cline's MCP settings (`cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "md-lantern-mcp": {
      "command": "npx",
      "args": ["-y", "@vk0/md-lantern-mcp"],
      "env": { "MD_LANTERN_URL": "https://md.vk0.dev", "MD_LANTERN_API_KEY": "mdl_..." }
    }
  }
}
```

### Codex

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.md-lantern-mcp]
command = "npx"
args = ["-y", "@vk0/md-lantern-mcp"]
env = { "MD_LANTERN_URL" = "https://md.vk0.dev", "MD_LANTERN_API_KEY" = "mdl_..." }
```

### CLI only

```bash
npm install -g @vk0/md-lantern-mcp
mdl --help
```

## CLI usage

```bash
# publish a file, or pipe stdin — prints exactly the page URL to stdout
mdl report.md
cat report.md | mdl

# publish under a stable local name: a second publish with the same --as
# updates the same page (same URL, next version) instead of creating a new one
mdl --as daily-status status.md
cat status.md | mdl --as daily-status

# everything else is explicit
mdl publish report.md --title "Weekly status" --style docs --expires 7d
mdl update <page> report.md --base-version 3
mdl get <page>                 # exact markdown, byte-for-byte, on stdout
mdl list
mdl versions <page>
mdl rm <page>

# machine-readable output for scripting
mdl report.md --json
```

`<page>` accepts a bare token, a full page URL (with or without `.md`, `/history`, or a
`/v/<n>` suffix), or a name you bound with `--as`.

## Config & environment

| Setting | Precedence (highest wins) |
|---|---|
| Server URL | `--url` (CLI only) → `MD_LANTERN_URL` → `config.json` → `https://md.vk0.dev` |
| API key | `MD_LANTERN_API_KEY` → `config.json` → none (anonymous) |
| Config directory | `MD_LANTERN_CONFIG_DIR` → `$XDG_CONFIG_HOME/md-lantern` → `~/.config/md-lantern` |

```bash
mdl config set-url https://md.vk0.dev
mdl config set-key mdl_...
mdl config show     # resolved URL + source, and a masked key — never the full key
mdl config unset-key
```

`config.json` and `pages.json` are created with mode `0600` in a `0700` directory, and
written atomically. Neither the API key nor any page's manage token is ever printed by
any command.

## Key vs. anonymous mode

| | With an API key | Without a key |
|---|---|---|
| Publish/update | `POST/PUT /api/v1/...`, Bearer-authenticated | the same anonymous `/publish` and `/p/:token/edit` routes the browser composer uses |
| Ownership | the key owns pages it published | a locally-remembered **manage token** owns the page on this machine |
| `mdl list` | every page this key has published | locally remembered pages only (this machine, this config dir) |
| `mdl versions` | works | requires a key — version history is a key-scoped feature |

Either way, `mdl get` always reads the page's public `source.json` — no key needed to
read a page back, only to manage one.

## Tools reference (MCP)

| Tool | Purpose |
|---|---|
| `publish_markdown` | Publish markdown as a new page (or update one bound by `name`) |
| `update_page` | Edit an existing page in place by token, URL, or name |
| `get_page` | Read back a page's current markdown and metadata |
| `list_pages` | List this key's pages, or locally remembered anonymous pages |
| `delete_page` | Permanently delete a page |
| `list_versions` | List every kept version of a page, newest first |

## Comparison

| | md-lantern-mcp | Gist | rentry.co | telegra.ph | Pasting into chat |
|---|---|---|---|---|---|
| Self-hosted | ✅ | ❌ | ❌ | ❌ | n/a |
| Agent-native (MCP tools) | ✅ | ❌ | ❌ | ❌ | n/a |
| Raw `.md` twin | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit in place, same URL | ✅ | ✅ | ✅ | ❌ | ❌ |
| Unfurls as a card in chat apps | ✅ | partial | partial | ✅ | ❌ |
| CLI + MCP from one package | ✅ | ❌ | ❌ | ❌ | n/a |

## FAQ

**Is a page private?** No. Every published page is public to anyone with its URL —
there's no access control beyond the link itself. Don't publish secrets.

**What happens without an API key?** Publishing still works anonymously, the same path
the browser composer uses. You get a local-only "manage token" instead of key ownership,
remembered in `pages.json` on the machine that published it.

**Can I run my own MD Lantern server?** Yes — that's the point. Point `MD_LANTERN_URL`
(or `mdl config set-url`) at any MD Lantern instance you operate.

**Does updating a page break the old link?** No — `update_page` / `mdl update` edit the
page in place. The URL stays the same; the replaced text becomes a version in the page's
public history.

**Why would an agent use this instead of just answering in chat?** Long reports, tables,
and logs are expensive to re-read from scrollback and awkward to unfurl. A link is cheap
to pass around, and the raw `.md` twin lets the next agent read the exact content back
without re-parsing chat formatting.

## License

[MIT](./LICENSE) © vk0.dev
