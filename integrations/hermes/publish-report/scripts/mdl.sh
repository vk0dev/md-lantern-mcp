#!/usr/bin/env bash
# Hermes wrapper around the `mdl` CLI (@vk0/md-lantern-mcp): publishes markdown to
# md.vk0.dev and prints only the page URL on stdout.
#
# Hermes keeps its own md-lantern config dir, so its pages are owned by the Hermes API
# key (they show up under that key in vk's cabinet) and its `--as` names never collide
# with the ones Claude Code sessions use. The key lives in that dir's config.json (mode
# 0600); it is never passed on the command line or printed.
#
#   mdl.sh report.md --title "…"         publish, print URL
#   mdl.sh --as factory-status status.md  one stable link, updated in place
#   mdl.sh update <url> report.md         new text at the same link
#   mdl.sh rm <url>                       delete
set -euo pipefail

export MD_LANTERN_CONFIG_DIR="${MD_LANTERN_CONFIG_DIR:-${HERMES_HOME:-$HOME/.hermes}/md-lantern}"

if command -v mdl >/dev/null 2>&1; then
  exec mdl "$@"
fi
for candidate in "$HOME"/.nvm/versions/node/*/bin/mdl /usr/local/bin/mdl /opt/homebrew/bin/mdl; do
  if [ -x "$candidate" ]; then
    exec "$candidate" "$@"
  fi
done

echo "mdl: the md-lantern CLI is not installed on this host (expected the 'mdl' command from @vk0/md-lantern-mcp)" >&2
exit 127
