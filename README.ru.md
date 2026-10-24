# md-lantern-mcp

[English](https://github.com/vk0dev/md-lantern-mcp/blob/main/README.md) | [日本語](https://github.com/vk0dev/md-lantern-mcp/blob/main/README.ja.md) | [简体中文](https://github.com/vk0dev/md-lantern-mcp/blob/main/README.zh-CN.md) | Русский | [Español](https://github.com/vk0dev/md-lantern-mcp/blob/main/README.es.md)

Публикуйте markdown как страницу с постоянной ссылкой, которой можно поделиться, — из AI-агента или из шелла,
вместо того чтобы вставлять в чат стену текста.

## Зачем и когда использовать

Берите этот инструмент в тот момент, когда иначе вы бы вставили длинный отчёт, широкую таблицу, дамп лога
или ответ с большим количеством кода прямо в разговор. Типичные поводы:

- «поделиться длинным отчётом по ссылке» вместо того, чтобы заливать чат markdown-разметкой
- «опубликовать markdown», который кому-то другому (человеку или агенту) понадобится открыть позже
- «отправить ссылку вместо стены текста», когда вывод вышел бы далеко за разумную
  длину сообщения
- создание **страницы статуса агента** — регулярного отчёта (ежедневный статус, итог сборки,
  журнал инцидентов), который должен жить по одному постоянному URL и просто обновляться на месте

Если содержимое должен дословно прочитать другой агент, к нему нужно вернуться позже, им нужно поделиться
в Telegram/Slack или сохранить как долговечный артефакт вместо прокрутки истории, — опубликуйте его
и передайте URL.

## Что это

MD Lantern — небольшой сервис публикации markdown на `md.vk0.dev` (URL
настраивается). Этот пакет — клиент для него, рассчитанный на агентов, и публикация работает
сразу из коробки, аккаунт не нужен:

- **Одна ссылка для всех мест** — URL страницы разворачивается в богатую карточку в Telegram, Slack и
  большинстве чат-приложений и отображается как обычная веб-страница в браузере.
- **Двойник `.md` для следующего агента** — каждая страница также отдаёт свой исходный markdown
  (`<url>.md`), который `mdl get` или инструмент `get_page` читает байт в байт, без
  скрейпинга.
- **Правка на месте с публичной историей** — обновление страницы сохраняет её URL рабочим;
  заменённый текст остаётся версией в публичной истории страницы, так что ничего
  не теряется молча.
- **Читаемые ссылки** — API-ключ может дать странице короткую ссылку `BASE/<slug>` вместо
  постоянного URL с токеном.
- **Коллекции** — именованный упорядоченный набор страниц со своей ссылкой; публикация в него
  добавляет страницу в конец, так поток отчётов собирается сам со временем.

Из одного пакета устанавливаются два исполняемых файла:

- `md-lantern-mcp` — stdio MCP-сервер, предоставляющий 13 инструментов любому MCP-совместимому клиенту-агенту.
- `mdl` — автономный CLI для шеллов и скриптов.

Оба обращаются к одному и тому же HTTP API MD Lantern и используют общую локальную память страниц, поэтому страница,
опубликованная из CLI, может быть обновлена из MCP-сервера (и наоборот) на той же
машине.

## Быстрый старт

```bash
# no account, no key: anonymous publish, the same flow the browser composer uses
echo '# Hello\n\nFrom mdl.' | mdl
# -> https://md.vk0.dev/p/AbCdEfGh1234

cat report.md | mdl
```

Если оператор вашего сервера MD Lantern выдал вам API-ключ, задайте
`MD_LANTERN_API_KEY` (или выполните `mdl config set-key`), чтобы также видеть список своих страниц и просматривать
историю версий — см. [Режим с ключом и анонимный режим](#режим-с-ключом-и-анонимный-режим).

## Установка

### Claude Code

```bash
claude mcp add md-lantern-mcp -- npx -y @vk0/md-lantern-mcp
```

Или добавьте в `.mcp.json`:

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

Добавьте в `claude_desktop_config.json`:

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

Добавьте в `.cursor/mcp.json`:

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

Добавьте в настройки MCP в Cline (`cline_mcp_settings.json`):

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

Добавьте в `~/.codex/config.toml`:

```toml
[mcp_servers.md-lantern-mcp]
command = "npx"
args = ["-y", "@vk0/md-lantern-mcp"]
env = { "MD_LANTERN_URL" = "https://md.vk0.dev" }
```

### Только CLI

```bash
npm install -g @vk0/md-lantern-mcp
mdl --help
```

## Использование CLI

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

В качестве `<page>` принимается голый токен, полный URL страницы (с `.md` или без, с суффиксом `/history` или
`/v/<n>`), URL читаемой ссылки (`BASE/<slug>`, с `.md` или без) или имя,
которое вы привязали через `--as`.

## Читаемые ссылки

API-ключ может дать странице короткую запоминающуюся ссылку вместо постоянного URL с токеном.
Читаемые ссылки и коллекции требуют API-ключ, выданный оператором сервера, —
без него эти команды сразу завершаются понятной ошибкой, ничего не публикуется.

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

Параметр `slug` у `update_page` и `slug` у `publish_markdown` делают то же самое
через MCP:

```json
{ "tool": "publish_markdown", "arguments": { "markdown": "# Hi\n", "slug": "how-we-work" } }
{ "tool": "update_page", "arguments": { "page": "<page>", "markdown": "# Hi v2\n", "slug": null } }
```

## Коллекции

Коллекция — это именованный упорядоченный набор страниц со своей читаемой ссылкой: так
поток отчётов (ежедневный статус, итоги сборок) собирается в одном месте для просмотра, а
многочастный документ сохраняет порядок.

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

Те же операции доступны как MCP-инструменты: `create_collection`, `get_collection`,
`list_collections`, `update_collection`, `add_to_collection`, `remove_from_collection`,
`delete_collection`, а также `collection` в `publish_markdown`:

```json
{ "tool": "create_collection", "arguments": { "slug": "daily-reports", "title": "Daily reports", "sort": "newest" } }
{ "tool": "publish_markdown", "arguments": { "markdown": "# Monday\n", "collection": "daily-reports" } }
```

В качестве `<collection>` принимается голый slug или полный URL коллекции; в качестве `<page>` — токен,
URL или локальное имя `--as`: локальные имена разрешаются на этой машине, всё остальное
отправляется на сервер как есть.

## Конфигурация и окружение

| Параметр | Приоритет (побеждает самый высокий) |
|---|---|
| URL сервера | `--url` (только CLI) → `MD_LANTERN_URL` → `config.json` → `https://md.vk0.dev` |
| API-ключ | `MD_LANTERN_API_KEY` → `config.json` → нет (анонимно) |
| Каталог конфигурации | `MD_LANTERN_CONFIG_DIR` → `$XDG_CONFIG_HOME/md-lantern` → `~/.config/md-lantern` |

```bash
mdl config set-url https://md.vk0.dev
mdl config set-key mdl_...
mdl config show     # resolved URL + source, and a masked key — never the full key
mdl config unset-key
```

`config.json` и `pages.json` создаются с правами `0600` в каталоге с правами `0700` и
записываются атомарно. Ни API-ключ, ни токен управления какой-либо страницы не выводится
ни одной командой.

## Режим с ключом и анонимный режим

| | С API-ключом | Без ключа |
|---|---|---|
| Публикация/обновление | `POST/PUT /api/v1/...`, с аутентификацией Bearer | те же анонимные маршруты `/publish` и `/p/:token/edit`, которые использует браузерный редактор |
| Владение | ключ владеет опубликованными им страницами | сохранённый локально **токен управления** владеет страницей на этой машине |
| `mdl list` | все страницы, опубликованные этим ключом | только локально запомненные страницы (эта машина, этот каталог конфигурации) |
| `mdl versions` | работает | требует ключ — история версий доступна только по ключу |

В любом случае `mdl get` всегда читает публичный `source.json` страницы — ключ не нужен,
чтобы прочитать страницу, он нужен только для управления ею.

## Справочник инструментов (MCP)

| Инструмент | Назначение |
|---|---|
| `publish_markdown` | Опубликовать markdown как новую страницу (или обновить страницу, привязанную через `name`); параметры `slug` и `collection` доступны с ключом |
| `update_page` | Править существующую страницу на месте по токену, URL или имени; `slug` задаёт, переименовывает или (со значением `null`) удаляет её читаемую ссылку |
| `get_page` | Прочитать текущий markdown страницы и её метаданные |
| `list_pages` | Показать страницы этого ключа или локально запомненные анонимные страницы |
| `delete_page` | Удалить страницу навсегда |
| `list_versions` | Показать все сохранённые версии страницы, сначала новые |
| `create_collection` | Создать именованную упорядоченную коллекцию страниц со своей ссылкой |
| `get_collection` | Прочитать коллекцию и её страницы по порядку |
| `list_collections` | Показать коллекции этого ключа |
| `update_collection` | Переименовать, изменить оформление или порядок коллекции |
| `add_to_collection` | Добавить одну страницу в коллекцию, в конец или на нужную позицию |
| `remove_from_collection` | Убрать одну страницу из коллекции (сама страница не затрагивается) |
| `delete_collection` | Удалить коллекцию навсегда (страницы в ней не затрагиваются) |

## Сравнение

| | md-lantern-mcp | Gist | rentry.co | telegra.ph | Вставка в чат |
|---|---|---|---|---|---|
| Нативно для агентов (инструменты MCP) | ✅ | ❌ | ❌ | ❌ | н/п |
| Исходный двойник `.md` | ✅ | ✅ | ❌ | ❌ | ❌ |
| Правка на месте, тот же URL | ✅ | ✅ | ✅ | ❌ | ❌ |
| Разворачивается карточкой в чат-приложениях | ✅ | частично | частично | ✅ | ❌ |
| CLI и MCP в одном пакете | ✅ | ❌ | ❌ | ❌ | н/п |

## FAQ

**Страница приватная?** Нет. Каждая опубликованная страница публична для любого, у кого есть её URL, —
доступ ограничивает только сама ссылка. Не публикуйте секреты.

**Что происходит без API-ключа?** Публикация по-прежнему работает анонимно, тем же путём,
что использует браузерный редактор. Вместо владения по ключу вы получаете локальный «токен управления»,
который запоминается в `pages.json` на машине, где страница была опубликована.

**Можно ли указать другой сервер MD Lantern?** Да — URL сервера
настраивается. Задайте `MD_LANTERN_URL` (или выполните `mdl config set-url`), и клиент будет работать с
любым совместимым сервером MD Lantern, к которому у вас есть доступ.

**Ломает ли обновление страницы старую ссылку?** Нет — `update_page` / `mdl update` правят
страницу на месте. URL остаётся прежним, а заменённый текст становится версией в публичной
истории страницы.

**Зачем агенту это, если можно просто ответить в чате?** Длинные отчёты, таблицы
и логи дорого перечитывать в истории прокрутки, и они плохо разворачиваются в карточки. Ссылку дёшево
передавать дальше, а исходный двойник `.md` позволяет следующему агенту прочитать точное содержимое
без повторного разбора форматирования чата.

## Лицензия

[MIT](./LICENSE) © vk0.dev
