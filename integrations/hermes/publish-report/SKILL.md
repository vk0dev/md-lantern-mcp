---
name: publish-report
description: Long reply or table for Telegram? Publish it, send a link.
version: 1.0.0
author: vk0.dev
platforms: [macos]
prerequisites:
  commands: [mdl]
metadata:
  hermes:
    tags: [Reporting, Telegram, Markdown, Publishing, md-lantern]
    related_skills: [daily-report-generation, daily-reporting]
---

# publish-report: a link instead of a wall of text

Telegram splits anything over 4096 characters into "(1/3)", "(2/3)" messages, and they are unreadable on a phone: tables fall apart and code loses its formatting. MD Lantern (md.vk0.dev) is vk's own markdown publisher. One command turns markdown into a clean page with a permanent link. In Telegram that link unfolds into a card with the title and the first paragraph. Russian pages get Russian chrome and hyphenation automatically.

## When to use

Publish and send the link if at least one of these holds:
- **Length:** the reply or report is longer than ~2500 characters (≈ more than one screen on a phone).
- **Table:** it has a table with more than 3 columns or more than 8 rows.
- **Code:** it has more than one code block, or a code block longer than ~15 lines.
- **Shareability:** the result should be easy to forward or come back to (a runbook, an analysis, a retrospective, an incident report, a long kanban card handoff).
- **vk asks for it:** "опубликуй", "в md", "ссылкой", "сделай страницу", or he forwards a long text and asks to turn it into a page.

## When NOT to use

- A short answer that fits on one screen: just reply.
- **Never publish secrets.** That means API keys, tokens, passwords, private data about people, the contents of `.env`, or Bitwarden output. A page is open to anyone who has the link; the link is unguessable, but it is not private. If a report contains secrets, either drop them or don't publish.
- Don't publish someone else's text verbatim on your own initiative (emails, other people's messages, client documents) unless vk asked.

## How to publish

1. **Write the markdown to a file**, for example `~/.hermes/tmp/report-<topic>.md`. Structure:
   - `# Heading`: it becomes the page title and the card title in Telegram.
   - **The first paragraph** is 1–2 sentences with the gist and the key numbers. It becomes the link preview text (up to ~160 characters), so it must make sense on its own.
   - Then `##` sections, lists and tables. Normal markdown: GFM tables, task lists and code with highlighting all work.
2. **Publish** with the bundled script. It prints only the URL to stdout:
   ```bash
   bash ~/.hermes/skills/productivity/publish-report/scripts/mdl.sh ~/.hermes/tmp/report-<topic>.md
   ```
   Useful flags:
   - `--title "…"`: when the `#` heading isn't the right title.
   - `--style docs`: technical text, runbooks, many tables. `--style book`: long prose. Otherwise leave the default (`clean`).
   - `--expires 30d`: **default for a reply in chat**: summaries, status answers, diagnostics, debug dumps. They are read now and are not needed in a month.
     Without `--expires` the page is permanent; that is for documents vk will come back to (a runbook, an analysis he asked to keep, rules, an agreement) and for `--as`.
   - `--as <name>`: **one stable link for a recurring or living document** (e.g. `--as factory-status`, `--as weekly-review`). A repeat call with the same name updates the same page in place. The link stays the same, and earlier versions remain in its public history. `<name>` is lowercase latin, digits and `-`.
   - `--collection <slug>`: appends the page to an existing collection instead of replacing one page in place — use for a recurring report stream where each entry should stay its own page (e.g. a daily log), browsable together at the collection's own link.
3. **Send a short message**: 2–5 lines in Russian. Say what this is, give 1–3 key takeaways (numbers, decisions, what is needed from vk), and put the link on its own line. Copy the URL from the command output exactly, without changing it.

Example message:
```
Разобрал падения coder за неделю: 7 из 9 — таймаут plan-pass на opus, лечится ретраем на sonnet.
От тебя ничего не нужно, ретрай уже включён.
https://md.vk0.dev/p/AbCdEfGh12345678
```

## Edit, look up, delete

- New text at the same link: `mdl.sh update <url-or-token> new.md`. Or repeat the publish with the same `--as <name>`.
- Current page text: `mdl.sh get <url>`. A list of your pages: `mdl.sh list`.
- Delete: `mdl.sh rm <url>`. Delete straight away a page that came out wrong or contains something that shouldn't be there.

## If something goes wrong

- **Exit code 2:** the server refused, and the reason is printed to stderr (`too_large`: the text is over 250,000 characters; `rate_limited`: wait a minute; `unauthorized`: the key in `~/.hermes/md-lantern/config.json` is wrong or revoked).
- **Exit code 3:** md.vk0.dev is unreachable.
- **Exit code 127:** `mdl` is not installed.
- In all these cases **don't lose the report**: send it as text, the old way, and mention in one line that the link didn't work.
- Don't retry more than once in a row.

## Pitfalls

- Don't paste the page's full text into the message alongside the link. Doing so defeats the point.
- Telegram caches link previews. After `update`, an already-sent message keeps showing the old card, but the page itself is always current.
- `--as` names live in `~/.hermes/md-lantern/pages.json` on this host. On another host the same name will create a new page.
- After `rm` the link returns 404 forever. Don't delete pages vk has already received unless he asks.
