# md-lantern-mcp

English | [日本語](https://github.com/vk0dev/md-lantern-mcp/blob/main/README.ja.md) | [简体中文](https://github.com/vk0dev/md-lantern-mcp/blob/main/README.zh-CN.md) | [Русский](https://github.com/vk0dev/md-lantern-mcp/blob/main/README.ru.md) | [Español](https://github.com/vk0dev/md-lantern-mcp/blob/main/README.es.md)

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

MD Lantern is a small markdown publishing service at `md.vk0.dev` (the URL is
configurable). This package is the agent-facing client for it, and publishing works
out of the box, no account needed:

- **One link, everywhere** — the page URL unfurls as a rich card in Telegram, Slack, and
  most chat apps, and renders as a normal web page in a browser.
- **A `.md` twin for the next agent** — every page also serves its raw markdown
  (`<url>.md`), read back byte-for-byte by `mdl get` or the `get_page` tool, no scraping
  required.
- **Edit in place, with public history** — updating a page keeps its URL working; the
  text it replaces is kept as a version in the page's public history, so nothing is
  silently lost.
- **Readable links** — an API key can give a page a short link, `BASE/<slug>`, instead
  of the permanent token URL.
- **Collections** — a named, ordered set of pages with its own link; publishing into one
  appends the page, which is how a stream of reports gathers itself over time.

This package ships two bins from one package:

- `md-lantern-mcp` — a stdio MCP server exposing 13 tools to any MCP-capable agent client.
- `mdl` — a standalone CLI for shells and scripts.

Both talk to the same MD Lantern HTTP API and share the same local page memory, so a page
published from the CLI can be updated from the MCP server (or vice versa) on the same
machine.

## Quick start

```bash
# no account, no key: anonymous publish, the same flow the browser composer uses
echo '# Hello\n\nFrom mdl.' | mdl
# -> https://md.vk0.dev/p/AbCdEfGh1234

cat report.md | mdl
```

If the operator of your MD Lantern server has issued you an API key, set
`MD_LANTERN_API_KEY` (or run `mdl config set-key`) to also list your pages and inspect
version history — see [Key vs. anonymous mode](#key-vs-anonymous-mode).

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
      "env": { "MD_LANTERN_URL": "https://md.vk0.dev" }
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
      "env": { "MD_LANTERN_URL": "https://md.vk0.dev" }
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
      "env": { "MD_LANTERN_URL": "https://md.vk0.dev" }
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
      "env": { "MD_LANTERN_URL": "https://md.vk0.dev" }
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
env = { "MD_LANTERN_URL" = "https://md.vk0.dev" }
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
`/v/<n>` suffix), a readable-link URL (`BASE/<slug>`, with or without `.md`), or a name
you bound with `--as`.

## Readable links

An API key can give a page a short, memorable link instead of the permanent token URL.
Readable links and collections require an API key issued by the server operator —
without one these commands fail fast with a clear error, nothing gets published.

```bash
mdl publish report.md --slug how-we-work
# -> https://md.vk0.dev/how-we-work

# a slug link works as <page> everywhere: get, update, versions, rm, slug
mdl get https://md.vk0.dev/how-we-work
mdl update https://md.vk0.dev/how-we-work report-v2.md

# mdl slug sets, renames, or clears a page's readable link; it always prints the link
mdl slug <page> how-we-work       # set
mdl slug how-we-work new-slug     # rename (old slug keeps redirecting)
mdl slug new-slug --clear         # back to the permanent /p/<token> link
```

The `slug` tool input on `update_page`, and `slug` on `publish_markdown`, do the same
over MCP:

```json
{ "tool": "publish_markdown", "arguments": { "markdown": "# Hi\n", "slug": "how-we-work" } }
{ "tool": "update_page", "arguments": { "page": "<page>", "markdown": "# Hi v2\n", "slug": null } }
```

## Collections

A collection is a named, ordered set of pages with its own readable link — the way a
stream of reports (daily status, build summaries) gathers into one browsable place, or a
multi-part document stays in order.

```bash
# create a collection, optionally seeded with pages (by URL or local --as name)
mdl collection create daily-reports --title "Daily reports" --sort newest

# publish straight into it — the page becomes the newest member
mdl publish report.md --collection daily-reports

# manage membership and metadata
mdl collection add daily-reports <page> --position 0
mdl collection rm daily-reports <page>
mdl collection get daily-reports            # the collection link, then one per page
mdl collection list                         # one line per collection
mdl collection update daily-reports --title "Status reports" --slug status
mdl collection delete daily-reports
```

The same operations are MCP tools: `create_collection`, `get_collection`,
`list_collections`, `update_collection`, `add_to_collection`, `remove_from_collection`,
`delete_collection`, plus `collection` on `publish_markdown`:

```json
{ "tool": "create_collection", "arguments": { "slug": "daily-reports", "title": "Daily reports", "sort": "newest" } }
{ "tool": "publish_markdown", "arguments": { "markdown": "# Monday\n", "collection": "daily-reports" } }
```

`<collection>` accepts a bare slug or a full collection URL; `<page>` accepts a token, a
URL, or a local `--as` name — local names are resolved on this machine, everything else
is sent to the server as-is.

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
| `publish_markdown` | Publish markdown as a new page (or update one bound by `name`); `slug` and `collection` inputs are available with a key |
| `update_page` | Edit an existing page in place by token, URL, or name; `slug` sets, renames, or (with `null`) clears its readable link |
| `get_page` | Read back a page's current markdown and metadata |
| `list_pages` | List this key's pages, or locally remembered anonymous pages |
| `delete_page` | Permanently delete a page |
| `list_versions` | List every kept version of a page, newest first |
| `create_collection` | Create a named, ordered collection of pages with its own link |
| `get_collection` | Read a collection and its member pages, in order |
| `list_collections` | List this key's collections |
| `update_collection` | Rename, restyle, or reorder a collection |
| `add_to_collection` | Add one page to a collection, at the end or at a position |
| `remove_from_collection` | Remove one page from a collection (the page itself is untouched) |
| `delete_collection` | Permanently delete a collection (member pages are untouched) |

## Comparison

| | md-lantern-mcp | Gist | rentry.co | telegra.ph | Pasting into chat |
|---|---|---|---|---|---|
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

**Can I point it at a different MD Lantern server?** Yes — the server URL is
configurable. Set `MD_LANTERN_URL` (or run `mdl config set-url`) and the client talks to
any compatible MD Lantern server you have access to.

**Does updating a page break the old link?** No — `update_page` / `mdl update` edit the
page in place. The URL stays the same; the replaced text becomes a version in the page's
public history.

**Why would an agent use this instead of just answering in chat?** Long reports, tables,
and logs are expensive to re-read from scrollback and awkward to unfurl. A link is cheap
to pass around, and the raw `.md` twin lets the next agent read the exact content back
without re-parsing chat formatting.

## License

[MIT](./LICENSE) © vk0.dev
