# Changelog

All notable changes to `@vk0/md-lantern-mcp` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-04

First public release: a stdio MCP server (`md-lantern-mcp`) and a CLI (`mdl`) for
publishing, updating, reading, listing, and deleting markdown pages on an MD Lantern
server, so an agent or shell script can share a long report as a link instead of
pasting it into chat.

### Added

- `mdl` CLI: `publish` (default command), `update`, `get`, `list`, `versions`, `rm`, and
  `config show|set-key|set-url|unset-key`. Reads markdown from a file, `-`, or stdin;
  supports `--title`, `--style`, `--expires`, `--breaks`, `--as NAME`, `--json`, `--url`.
- `md-lantern-mcp` MCP server exposing six tools: `publish_markdown`, `update_page`,
  `get_page`, `list_pages`, `delete_page`, `list_versions`.
- Key-authenticated and anonymous publishing paths, chosen automatically by whether
  `MD_LANTERN_API_KEY` (or a configured key) is present.
- Local page memory (`pages.json`) shared by the CLI and the MCP server, recording each
  published page's URL, title, and manage token so anonymous edits/deletes work later
  from the same machine.
- Page references resolved from a bare token, a full page URL (with `.md`, `/history`,
  or `/v/<n>` suffixes), or a locally bound name.
- `mdl config` / `MD_LANTERN_URL` / `MD_LANTERN_API_KEY` / `MD_LANTERN_CONFIG_DIR` for
  configuring the server URL and API key, with config files written atomically at
  mode `0600` in a `0700` directory.
