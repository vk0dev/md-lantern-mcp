# md-lantern-mcp

[English](https://github.com/vk0dev/md-lantern-mcp/blob/main/README.md) | 日本語 | [简体中文](https://github.com/vk0dev/md-lantern-mcp/blob/main/README.zh-CN.md) | [Русский](https://github.com/vk0dev/md-lantern-mcp/blob/main/README.ru.md) | [Español](https://github.com/vk0dev/md-lantern-mcp/blob/main/README.es.md)

AI エージェントやシェルから、markdown を永続リンク付きの共有ページとして公開できます。
チャットに長文を貼り付ける必要はありません。

## なぜ使うか / どんなときに使うか

長いレポート、幅の広い表、ログのダンプ、コードだらけの回答を会話にそのまま貼り付けたくなったら、
まずこれを使ってください。典型的なきっかけは次のとおりです。

- 「長いレポートをリンクで共有する」: チャットを markdown であふれさせない
- 「markdown を公開する」: 他の誰か(人間でもエージェントでも)が後で開く必要がある
- 「長文の代わりにリンクを送る」: 出力が妥当なメッセージ長を大きく超えるとき
- **エージェントのステータスページ**の構築: 定期レポート(日次ステータス、ビルド概要、
  インシデントログ)を 1 つの安定した URL に置き、その場で更新し続ける

内容を別のエージェントがそのまま読み返す、後で見直す、Telegram/Slack で共有する、
スクロール履歴ではなく残る成果物として保管する、といった場合は、公開して URL を渡してください。

## これは何か

MD Lantern は `md.vk0.dev` で動く小さな markdown 公開サービスです(URL は
変更可能)。このパッケージはそのエージェント向けクライアントで、アカウント不要で
そのまま公開できます。

- **1 つのリンクがどこでも使える** — ページ URL は Telegram、Slack、ほとんどのチャットアプリで
  リッチカードとして展開され、ブラウザでは通常の Web ページとして表示されます。
- **次のエージェント向けの `.md` ツイン** — すべてのページが生の markdown
  (`<url>.md`)も配信し、`mdl get` または `get_page` ツールでバイト単位で正確に読み戻せます。
  スクレイピングは不要です。
- **公開履歴つきのその場編集** — ページを更新しても URL はそのまま使えます。
  置き換えられたテキストはページの公開履歴にバージョンとして残るので、何も黙って失われません。
- **読みやすいリンク** — API キーがあれば、永続的なトークン URL の代わりに
  短いリンク `BASE/<slug>` をページに付けられます。
- **コレクション** — 独自のリンクを持つ、名前付きで順序のあるページの集合です。
  コレクションへ公開するとページが末尾に追加され、レポートのストリームが時間とともに集まっていきます。

このパッケージは 1 つのパッケージから 2 つの bin を提供します。

- `md-lantern-mcp` — MCP 対応のあらゆるエージェントクライアントに 13 個のツールを提供する stdio MCP サーバー。
- `mdl` — シェルとスクリプト向けのスタンドアロン CLI。

どちらも同じ MD Lantern HTTP API を使い、ローカルのページ記憶を共有します。そのため、
同じマシン上で、CLI で公開したページを MCP サーバーから更新できます(その逆も可能です)。

## クイックスタート

```bash
# no account, no key: anonymous publish, the same flow the browser composer uses
echo '# Hello\n\nFrom mdl.' | mdl
# -> https://md.vk0.dev/p/AbCdEfGh1234

cat report.md | mdl
```

お使いの MD Lantern サーバーの運営者から API キーが発行されている場合は、
`MD_LANTERN_API_KEY` を設定する(または `mdl config set-key` を実行する)と、
自分のページの一覧表示とバージョン履歴の確認もできます。詳しくは
[キーモードと匿名モード](#キーモードと匿名モード)を参照してください。

## インストール

### Claude Code

```bash
claude mcp add md-lantern-mcp -- npx -y @vk0/md-lantern-mcp
```

または `.mcp.json` に追加します。

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

`claude_desktop_config.json` に追加します。

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

`.cursor/mcp.json` に追加します。

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

Cline の MCP 設定(`cline_mcp_settings.json`)に追加します。

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

`~/.codex/config.toml` に追加します。

```toml
[mcp_servers.md-lantern-mcp]
command = "npx"
args = ["-y", "@vk0/md-lantern-mcp"]
env = { "MD_LANTERN_URL" = "https://md.vk0.dev" }
```

### CLI のみ

```bash
npm install -g @vk0/md-lantern-mcp
mdl --help
```

## CLI の使い方

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

`<page>` には、トークンそのもの、ページの完全な URL(`.md`、`/history`、`/v/<n>` の
サフィックスの有無は問いません)、読みやすいリンクの URL(`BASE/<slug>`、`.md` の有無は問いません)、
または `--as` で割り当てた名前を指定できます。

## 読みやすいリンク

API キーがあれば、永続的なトークン URL の代わりに、短く覚えやすいリンクをページに付けられます。
読みやすいリンクとコレクションには、サーバー運営者が発行した API キーが必要です。
キーがない場合、これらのコマンドは明確なエラーですぐに失敗し、何も公開されません。

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

`update_page` の `slug` ツール入力と `publish_markdown` の `slug` は、MCP 経由で同じことを行います。

```json
{ "tool": "publish_markdown", "arguments": { "markdown": "# Hi\n", "slug": "how-we-work" } }
{ "tool": "update_page", "arguments": { "page": "<page>", "markdown": "# Hi v2\n", "slug": null } }
```

## コレクション

コレクションは、独自の読みやすいリンクを持つ、名前付きで順序のあるページの集合です。
レポートのストリーム(日次ステータス、ビルド概要)を 1 か所にまとめて閲覧できるようにしたり、
複数パートのドキュメントを順序どおりに保ったりできます。

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

同じ操作が MCP ツールとしても用意されています。`create_collection`、`get_collection`、
`list_collections`、`update_collection`、`add_to_collection`、`remove_from_collection`、
`delete_collection`、さらに `publish_markdown` の `collection` です。

```json
{ "tool": "create_collection", "arguments": { "slug": "daily-reports", "title": "Daily reports", "sort": "newest" } }
{ "tool": "publish_markdown", "arguments": { "markdown": "# Monday\n", "collection": "daily-reports" } }
```

`<collection>` にはスラッグそのもの、またはコレクションの完全な URL を指定できます。`<page>` には
トークン、URL、またはローカルの `--as` 名を指定できます。ローカル名はこのマシン上で解決され、
それ以外はそのままサーバーに送られます。

## 設定と環境変数

| 設定 | 優先順位(上が優先) |
|---|---|
| サーバー URL | `--url`(CLI のみ) → `MD_LANTERN_URL` → `config.json` → `https://md.vk0.dev` |
| API キー | `MD_LANTERN_API_KEY` → `config.json` → なし(匿名) |
| 設定ディレクトリ | `MD_LANTERN_CONFIG_DIR` → `$XDG_CONFIG_HOME/md-lantern` → `~/.config/md-lantern` |

```bash
mdl config set-url https://md.vk0.dev
mdl config set-key mdl_...
mdl config show     # resolved URL + source, and a masked key — never the full key
mdl config unset-key
```

`config.json` と `pages.json` は、モード `0700` のディレクトリにモード `0600` で作成され、
アトミックに書き込まれます。API キーも各ページの管理トークンも、どのコマンドでも
出力されることはありません。

## キーモードと匿名モード

| | API キーあり | キーなし |
|---|---|---|
| 公開/更新 | `POST/PUT /api/v1/...`、Bearer 認証 | ブラウザのコンポーザーが使うのと同じ匿名の `/publish` と `/p/:token/edit` ルート |
| 所有権 | キーが、公開したページを所有する | ローカルに記憶された**管理トークン**が、このマシン上でページを所有する |
| `mdl list` | このキーが公開したすべてのページ | ローカルに記憶されたページのみ(このマシン、この設定ディレクトリ) |
| `mdl versions` | 使える | キーが必要 — バージョン履歴はキー単位の機能 |

どちらの場合でも、`mdl get` は常にページの公開 `source.json` を読みます。ページを読み戻すのにキーは不要で、
管理するときだけ必要です。

## ツールリファレンス(MCP)

| ツール | 用途 |
|---|---|
| `publish_markdown` | markdown を新しいページとして公開(または `name` で紐付けたページを更新)。キーがあれば `slug` と `collection` の入力が使える |
| `update_page` | 既存のページをトークン、URL、または名前でその場編集。`slug` で読みやすいリンクを設定・変更し、`null` を指定すると解除する |
| `get_page` | ページの現在の markdown とメタデータを読み戻す |
| `list_pages` | このキーのページ、またはローカルに記憶された匿名ページを一覧表示 |
| `delete_page` | ページを完全に削除 |
| `list_versions` | ページの保持されているすべてのバージョンを新しい順に一覧表示 |
| `create_collection` | 独自のリンクを持つ、名前付きで順序のあるページのコレクションを作成 |
| `get_collection` | コレクションとそのメンバーページを順序どおりに読み取る |
| `list_collections` | このキーのコレクションを一覧表示 |
| `update_collection` | コレクションの名前変更、スタイル変更、並べ替え |
| `add_to_collection` | 1 ページをコレクションの末尾または指定位置に追加 |
| `remove_from_collection` | 1 ページをコレクションから削除(ページ自体はそのまま) |
| `delete_collection` | コレクションを完全に削除(メンバーページはそのまま) |

## 比較

| | md-lantern-mcp | Gist | rentry.co | telegra.ph | チャットへの貼り付け |
|---|---|---|---|---|---|
| エージェントネイティブ(MCP ツール) | ✅ | ❌ | ❌ | ❌ | 該当なし |
| 生の `.md` ツイン | ✅ | ✅ | ❌ | ❌ | ❌ |
| 同じ URL でその場編集 | ✅ | ✅ | ✅ | ❌ | ❌ |
| チャットアプリでカードとして展開 | ✅ | 一部 | 一部 | ✅ | ❌ |
| 1 つのパッケージで CLI + MCP | ✅ | ❌ | ❌ | ❌ | 該当なし |

## FAQ

**ページは非公開ですか?** いいえ。公開されたページはすべて、URL を知っている人なら誰でも見られます。
リンクそのもの以外のアクセス制御はありません。シークレットは公開しないでください。

**API キーがないとどうなりますか?** 匿名での公開は引き続き使え、ブラウザのコンポーザーと同じ経路を使います。
キーによる所有権の代わりに、ローカル専用の「管理トークン」が発行され、公開したマシンの
`pages.json` に記憶されます。

**別の MD Lantern サーバーを指定できますか?** はい。サーバー URL は変更できます。
`MD_LANTERN_URL` を設定する(または `mdl config set-url` を実行する)と、クライアントは
アクセス権のある互換性のある任意の MD Lantern サーバーと通信します。

**ページを更新すると古いリンクは壊れますか?** いいえ。`update_page` / `mdl update` はページを
その場で編集します。URL は変わらず、置き換えられたテキストはページの公開履歴にバージョンとして残ります。

**エージェントがチャットで答える代わりにこれを使う理由は?** 長いレポート、表、ログは、
スクロールバックから読み直すのに手間がかかり、展開もしづらいものです。リンクなら受け渡しが軽く、
生の `.md` ツインがあれば、次のエージェントがチャットの書式を再パースせずに正確な内容を読み戻せます。

## ライセンス

[MIT](./LICENSE) © vk0.dev
