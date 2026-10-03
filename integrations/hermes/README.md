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

The skill alone is not enough: in trials the agent formatted a 10k-character reply for the phone
instead of reaching for it. What makes it fire is a Telegram platform hint in `~/.hermes/config.yaml`
(top-level key, not under `agent:`):

```yaml
platform_hints:
  telegram:
    append: >-
      Long replies: if your reply would run past ~2500 characters (more than one phone
      screen), or needs a table with more than 3 columns, or several code blocks, do not
      send it as a wall of text split into (1/N) messages. Load the publish-report skill,
      publish the full text to md.vk0.dev with it, and reply with 2-5 lines (the gist,
      what is needed from vk) plus the link on its own line. Never publish secrets or
      private personal data; if the content has them, reply in chat as usual.
```

With it, the same request came back as a 701-character summary plus the link.
`test/telegram-hint-trial.py` reproduces the trial without sending anything.

The wrapper `scripts/mdl.sh` points `mdl` at `~/.hermes/md-lantern/`, so Hermes publishes with its
own key (its pages are listed under that key in the owner cabinet) and its `--as` names never
collide with other agents on the same host. The skill text is written for vk's setup (md.vk0.dev,
Russian replies); adapt the host and language for yours.
