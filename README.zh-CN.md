# md-lantern-mcp

[English](https://github.com/vk0dev/md-lantern-mcp/blob/main/README.md) | [日本語](https://github.com/vk0dev/md-lantern-mcp/blob/main/README.ja.md) | 简体中文 | [Русский](https://github.com/vk0dev/md-lantern-mcp/blob/main/README.ru.md) | [Español](https://github.com/vk0dev/md-lantern-mcp/blob/main/README.es.md)

从 AI 智能体或 shell 中，把 markdown 发布为带永久链接的可分享页面——
不必再把大段文字粘贴进聊天。

## 为什么用 / 何时使用

每当你想把长报告、宽表格、日志输出或满是代码的回答直接粘贴进对话时，就该用它。典型场景：

- “把长报告作为链接分享”，而不是用 markdown 刷满聊天
- “发布 markdown”，供其他人（真人或智能体）稍后打开
- “发送链接，而不是一大堆文字”——当输出长度会远超合理的消息长度时
- 搭建**智能体状态页**——定期报告（每日状态、构建摘要、事故日志）只放在一个固定 URL 上，并原地更新

如果内容需要被另一个智能体逐字读回、日后再次查看、分享到 Telegram/Slack，或作为持久产物保存而不是淹没在滚动历史里，就发布它，然后交出 URL。

## 它是什么

MD Lantern 是位于 `md.vk0.dev` 的轻量 markdown 发布服务（URL 可配置）。本软件包是它面向智能体的客户端，开箱即可发布，无需账号：

- **一个链接，通行各处**——页面 URL 在 Telegram、Slack 和大多数聊天应用中展开为富卡片，在浏览器中呈现为普通网页。
- **为下一个智能体准备的 `.md` 孪生版本**——每个页面同时提供其原始 markdown（`<url>.md`），可通过 `mdl get` 或 `get_page` 工具逐字节读回，无需抓取网页。
- **原地编辑，公开历史**——更新页面后 URL 依然有效；被替换的文本会作为一个版本保留在页面的公开历史中，不会悄悄丢失。
- **可读链接**——API 密钥可以为页面生成短链接 `BASE/<slug>`，取代永久的 token URL。
- **集合**——由命名、有序的页面组成、并拥有独立链接的集合；向其中发布会把页面追加进去，一连串报告就这样随时间自行汇聚。

本软件包由同一个包提供两个可执行文件：

- `md-lantern-mcp`——stdio MCP 服务器，向任何支持 MCP 的智能体客户端提供 13 个工具。
- `mdl`——面向 shell 和脚本的独立 CLI。

两者调用同一套 MD Lantern HTTP API，并共享同一份本地页面记忆，因此在同一台机器上，用 CLI 发布的页面可以由 MCP 服务器更新（反之亦然）。

## 快速开始

```bash
# 无需账号、无需密钥：匿名发布，与浏览器编辑器使用的流程相同
echo '# Hello\n\nFrom mdl.' | mdl
# -> https://md.vk0.dev/p/AbCdEfGh1234

cat report.md | mdl
```

如果你的 MD Lantern 服务器运营方已为你签发了 API 密钥，请设置 `MD_LANTERN_API_KEY`（或运行 `mdl config set-key`），即可列出你的页面并查看版本历史——参见[密钥模式与匿名模式](#密钥模式与匿名模式)。

## 安装

### Claude Code

```bash
claude mcp add md-lantern-mcp -- npx -y @vk0/md-lantern-mcp
```

或者将其添加到 `.mcp.json`：

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

添加到 `claude_desktop_config.json`：

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

添加到 `.cursor/mcp.json`：

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

添加到 Cline 的 MCP 设置（`cline_mcp_settings.json`）：

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

添加到 `~/.codex/config.toml`：

```toml
[mcp_servers.md-lantern-mcp]
command = "npx"
args = ["-y", "@vk0/md-lantern-mcp"]
env = { "MD_LANTERN_URL" = "https://md.vk0.dev" }
```

### 仅 CLI

```bash
npm install -g @vk0/md-lantern-mcp
mdl --help
```

## CLI 用法

```bash
# 发布文件，或通过管道传入 stdin——向 stdout 只输出页面 URL
mdl report.md
cat report.md | mdl

# 以固定的本地名称发布：用相同的 --as 再次发布，
# 会更新同一个页面（URL 不变，版本递增），而不是新建页面
mdl --as daily-status status.md
cat status.md | mdl --as daily-status

# 其余操作都需显式指定
mdl publish report.md --title "Weekly status" --style docs --expires 7d
mdl update <page> report.md --base-version 3
mdl get <page>                 # 精确的 markdown，逐字节输出到 stdout
mdl list
mdl versions <page>
mdl rm <page>

# 供脚本使用的机器可读输出
mdl report.md --json
```

`<page>` 可以是裸 token、完整的页面 URL（带或不带 `.md`、`/history` 或 `/v/<n>` 后缀）、可读链接 URL（`BASE/<slug>`，带或不带 `.md`），或你用 `--as` 绑定的名称。

## 可读链接

API 密钥可以为页面生成简短、好记的链接，取代永久的 token URL。可读链接和集合需要服务器运营方签发的 API 密钥——没有密钥时，这些命令会立即失败并给出清晰的错误，不会发布任何内容。

```bash
mdl publish report.md --slug how-we-work
# -> https://md.vk0.dev/how-we-work

# slug 链接在任何地方都可以当作 <page> 使用：get、update、versions、rm、slug
mdl get https://md.vk0.dev/how-we-work
mdl update https://md.vk0.dev/how-we-work report-v2.md

# mdl slug 用于设置、重命名或清除页面的可读链接；它始终会输出该链接
mdl slug <page> how-we-work       # 设置
mdl slug how-we-work new-slug     # 重命名（旧 slug 继续重定向）
mdl slug new-slug --clear         # 回到永久的 /p/<token> 链接
```

`update_page` 上的 `slug` 工具输入，以及 `publish_markdown` 上的 `slug`，通过 MCP 实现同样的功能：

```json
{ "tool": "publish_markdown", "arguments": { "markdown": "# Hi\n", "slug": "how-we-work" } }
{ "tool": "update_page", "arguments": { "page": "<page>", "markdown": "# Hi v2\n", "slug": null } }
```

## 集合

集合是由命名、有序的页面组成、并拥有独立可读链接的集合——一连串报告（每日状态、构建摘要）借此汇聚到一个可浏览的地方，多部分文档也借此保持顺序。

```bash
# 创建集合，可选地预置页面（通过 URL 或本地 --as 名称）
mdl collection create daily-reports --title "Daily reports" --sort newest

# 直接发布到集合中——该页面成为最新成员
mdl publish report.md --collection daily-reports

# 管理成员与元数据
mdl collection add daily-reports <page> --position 0
mdl collection rm daily-reports <page>
mdl collection get daily-reports            # 先输出集合链接，再每个页面一行
mdl collection list                         # 每个集合一行
mdl collection update daily-reports --title "Status reports" --slug status
mdl collection delete daily-reports
```

相同的操作也以 MCP 工具形式提供：`create_collection`、`get_collection`、`list_collections`、`update_collection`、`add_to_collection`、`remove_from_collection`、`delete_collection`，以及 `publish_markdown` 上的 `collection`：

```json
{ "tool": "create_collection", "arguments": { "slug": "daily-reports", "title": "Daily reports", "sort": "newest" } }
{ "tool": "publish_markdown", "arguments": { "markdown": "# Monday\n", "collection": "daily-reports" } }
```

`<collection>` 可以是裸 slug 或完整的集合 URL；`<page>` 可以是 token、URL 或本地 `--as` 名称——本地名称在本机解析，其余内容原样发送给服务器。

## 配置与环境

| 设置项 | 优先级（高者优先） |
|---|---|
| 服务器 URL | `--url`（仅 CLI）→ `MD_LANTERN_URL` → `config.json` → `https://md.vk0.dev` |
| API 密钥 | `MD_LANTERN_API_KEY` → `config.json` → 无（匿名） |
| 配置目录 | `MD_LANTERN_CONFIG_DIR` → `$XDG_CONFIG_HOME/md-lantern` → `~/.config/md-lantern` |

```bash
mdl config set-url https://md.vk0.dev
mdl config set-key mdl_...
mdl config show     # 解析后的 URL 及其来源，以及打码后的密钥——绝不显示完整密钥
mdl config unset-key
```

`config.json` 和 `pages.json` 以 `0600` 权限创建在 `0700` 目录中，并以原子方式写入。任何命令都不会输出 API 密钥或任何页面的管理 token。

## 密钥模式与匿名模式

| | 使用 API 密钥 | 不使用密钥 |
|---|---|---|
| 发布/更新 | `POST/PUT /api/v1/...`，Bearer 认证 | 与浏览器编辑器相同的匿名 `/publish` 和 `/p/:token/edit` 路由 |
| 所有权 | 密钥拥有它发布的页面 | 本地记住的**管理 token** 在本机拥有该页面 |
| `mdl list` | 此密钥发布的所有页面 | 仅限本地记住的页面（本机、本配置目录） |
| `mdl versions` | 可用 | 需要密钥——版本历史是按密钥划分的功能 |

无论哪种方式，`mdl get` 始终读取页面公开的 `source.json`——读回页面无需密钥，只有管理页面才需要。

## 工具参考（MCP）

| 工具 | 用途 |
|---|---|
| `publish_markdown` | 将 markdown 发布为新页面（或更新由 `name` 绑定的页面）；有密钥时可使用 `slug` 和 `collection` 输入 |
| `update_page` | 通过 token、URL 或名称原地编辑现有页面；`slug` 用于设置、重命名，或（传入 `null` 时）清除其可读链接 |
| `get_page` | 读回页面当前的 markdown 和元数据 |
| `list_pages` | 列出此密钥的页面，或本地记住的匿名页面 |
| `delete_page` | 永久删除页面 |
| `list_versions` | 列出页面保留的所有版本，最新的在前 |
| `create_collection` | 创建拥有独立链接的、命名且有序的页面集合 |
| `get_collection` | 按顺序读取集合及其成员页面 |
| `list_collections` | 列出此密钥的集合 |
| `update_collection` | 重命名、调整样式或重新排序集合 |
| `add_to_collection` | 向集合添加一个页面，放在末尾或指定位置 |
| `remove_from_collection` | 从集合中移除一个页面（页面本身不受影响） |
| `delete_collection` | 永久删除集合（成员页面不受影响） |

## 对比

| | md-lantern-mcp | Gist | rentry.co | telegra.ph | 粘贴进聊天 |
|---|---|---|---|---|---|
| 智能体原生（MCP 工具） | ✅ | ❌ | ❌ | ❌ | 不适用 |
| 原始 `.md` 孪生版本 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 原地编辑，URL 不变 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 在聊天应用中展开为卡片 | ✅ | 部分 | 部分 | ✅ | ❌ |
| 一个包同时提供 CLI + MCP | ✅ | ❌ | ❌ | ❌ | 不适用 |

## 常见问题

**页面是私有的吗？** 不是。每个已发布的页面对任何拥有其 URL 的人都是公开的——除了链接本身没有任何访问控制。不要发布机密。

**没有 API 密钥会怎样？** 仍然可以匿名发布，路径与浏览器编辑器相同。你会得到一个仅限本地的“管理 token”，而不是密钥所有权，它记录在发布所在机器的 `pages.json` 中。

**可以指向其他 MD Lantern 服务器吗？** 可以——服务器 URL 可配置。设置 `MD_LANTERN_URL`（或运行 `mdl config set-url`），客户端即可与你有权访问的任何兼容 MD Lantern 服务器通信。

**更新页面会让旧链接失效吗？** 不会——`update_page` / `mdl update` 是原地编辑页面。URL 保持不变；被替换的文本成为页面公开历史中的一个版本。

**为什么智能体要用它，而不是直接在聊天里回答？** 长报告、表格和日志很难从滚动记录中重新阅读，也不便于展开。链接传递成本低，而原始 `.md` 孪生版本让下一个智能体可以读回确切内容，无需重新解析聊天格式。

## 许可证

[MIT](./LICENSE) © vk0.dev
