# Hermes integration

`publish-report/` is a [Hermes](https://github.com/NousResearch/hermes-agent) skill: when a reply
or report would be longer than a phone screen (or has wide tables or several code blocks), the
agent publishes it with `mdl` and sends a 2–5 line summary plus the link instead of a wall of text.

Install on a Hermes host:

```bash
npm i -g @vk0/md-lantern-mcp                       # provides `mdl`
mkdir -p ~/.hermes/skills/productivity
cp -R publish-report ~/.hermes/skills/productivity/
MD_LANTERN_CONFIG_DIR=~/.hermes/md-lantern mdl config set-key <a key minted for Hermes>
hermes curator pin publish-report                  # keep the curator from archiving it
```

The wrapper `scripts/mdl.sh` points `mdl` at `~/.hermes/md-lantern/`, so Hermes publishes with its
own key (its pages are listed under that key in the owner cabinet) and its `--as` names never
collide with other agents on the same host. The skill text is written for vk's setup (md.vk0.dev,
Russian replies); adapt the host and language for yours.
