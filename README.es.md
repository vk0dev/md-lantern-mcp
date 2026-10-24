# md-lantern-mcp

[English](https://github.com/vk0dev/md-lantern-mcp/blob/main/README.md) | [日本語](https://github.com/vk0dev/md-lantern-mcp/blob/main/README.ja.md) | [简体中文](https://github.com/vk0dev/md-lantern-mcp/blob/main/README.zh-CN.md) | [Русский](https://github.com/vk0dev/md-lantern-mcp/blob/main/README.ru.md) | Español

Publica markdown como una página compartible con un enlace permanente, desde un agente de IA o una terminal,
en lugar de pegar un muro de texto en el chat.

## Por qué / Cuándo usarlo

Recurre a esto en el momento en que, de otro modo, pegarías un informe largo, una tabla ancha, un volcado de logs
o una respuesta cargada de código directamente en una conversación. Disparadores típicos:

- "compartir un informe largo como enlace" en lugar de inundar el chat con markdown
- "publicar markdown" que otra persona (humana o agente) necesita abrir más tarde
- "enviar un enlace en lugar de un muro de texto" cuando la salida superaría una longitud
  razonable de mensaje
- crear una **página de estado de agente**: un informe recurrente (estado diario, resumen de build,
  registro de incidentes) que debe vivir en una única URL estable y simplemente actualizarse en su lugar

Si otro agente necesita leer el contenido textualmente, si quieres retomarlo más tarde, compartirlo
en Telegram/Slack o conservarlo como un artefacto duradero en lugar de perderlo en el historial, publícalo
y entrega la URL.

## Qué es

MD Lantern es un pequeño servicio de publicación de markdown en `md.vk0.dev` (la URL es
configurable). Este paquete es el cliente para agentes, y publicar funciona
desde el primer momento, sin necesidad de cuenta:

- **Un enlace, en todas partes**: la URL de la página se despliega como tarjeta enriquecida en Telegram, Slack y
  la mayoría de las apps de chat, y se muestra como una página web normal en el navegador.
- **Un gemelo `.md` para el siguiente agente**: cada página sirve también su markdown original
  (`<url>.md`), que `mdl get` o la herramienta `get_page` leen byte por byte, sin
  necesidad de scraping.
- **Edición en su lugar, con historial público**: actualizar una página mantiene su URL funcionando; el
  texto reemplazado se conserva como una versión en el historial público de la página, así que nada
  se pierde en silencio.
- **Enlaces legibles**: una clave de API puede dar a una página un enlace corto, `BASE/<slug>`, en lugar
  de la URL permanente con token.
- **Colecciones**: un conjunto ordenado y con nombre de páginas, con su propio enlace; publicar en una
  añade la página, y así es como un flujo de informes se reúne solo con el tiempo.

Este paquete incluye dos binarios en un solo paquete:

- `md-lantern-mcp`: un servidor MCP stdio que expone 13 herramientas a cualquier cliente de agente compatible con MCP.
- `mdl`: una CLI independiente para terminales y scripts.

Ambos hablan con la misma API HTTP de MD Lantern y comparten la misma memoria local de páginas, así que una página
publicada desde la CLI puede actualizarse desde el servidor MCP (o al revés) en la misma
máquina.

## Inicio rápido

```bash
# sin cuenta, sin clave: publicación anónima, el mismo flujo que usa el editor del navegador
echo '# Hello\n\nFrom mdl.' | mdl
# -> https://md.vk0.dev/p/AbCdEfGh1234

cat report.md | mdl
```

Si el operador de tu servidor MD Lantern te ha emitido una clave de API, define
`MD_LANTERN_API_KEY` (o ejecuta `mdl config set-key`) para además listar tus páginas e inspeccionar
el historial de versiones; consulta [Modo con clave vs. modo anónimo](#modo-con-clave-vs-modo-anónimo).

## Instalación

### Claude Code

```bash
claude mcp add md-lantern-mcp -- npx -y @vk0/md-lantern-mcp
```

O añádelo a `.mcp.json`:

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

Añade a `claude_desktop_config.json`:

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

Añade a `.cursor/mcp.json`:

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

Añade a la configuración MCP de Cline (`cline_mcp_settings.json`):

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

Añade a `~/.codex/config.toml`:

```toml
[mcp_servers.md-lantern-mcp]
command = "npx"
args = ["-y", "@vk0/md-lantern-mcp"]
env = { "MD_LANTERN_URL" = "https://md.vk0.dev" }
```

### Solo CLI

```bash
npm install -g @vk0/md-lantern-mcp
mdl --help
```

## Uso de la CLI

```bash
# publica un archivo, o canaliza stdin: imprime exactamente la URL de la página en stdout
mdl report.md
cat report.md | mdl

# publica bajo un nombre local estable: una segunda publicación con el mismo --as
# actualiza la misma página (misma URL, siguiente versión) en lugar de crear una nueva
mdl --as daily-status status.md
cat status.md | mdl --as daily-status

# todo lo demás es explícito
mdl publish report.md --title "Weekly status" --style docs --expires 7d
mdl update <page> report.md --base-version 3
mdl get <page>                 # markdown exacto, byte por byte, en stdout
mdl list
mdl versions <page>
mdl rm <page>

# salida legible por máquina para scripting
mdl report.md --json
```

`<page>` acepta un token simple, una URL completa de página (con o sin `.md`, `/history` o un
sufijo `/v/<n>`), una URL de enlace legible (`BASE/<slug>`, con o sin `.md`), o un nombre
que hayas vinculado con `--as`.

## Enlaces legibles

Una clave de API puede dar a una página un enlace corto y memorable en lugar de la URL permanente con token.
Los enlaces legibles y las colecciones requieren una clave de API emitida por el operador del servidor;
sin ella, estos comandos fallan de inmediato con un error claro y no se publica nada.

```bash
mdl publish report.md --slug how-we-work
# -> https://md.vk0.dev/how-we-work

# un enlace con slug funciona como <page> en todas partes: get, update, versions, rm, slug
mdl get https://md.vk0.dev/how-we-work
mdl update https://md.vk0.dev/how-we-work report-v2.md

# mdl slug define, renombra o elimina el enlace legible de una página; siempre imprime el enlace
mdl slug <page> how-we-work       # definir
mdl slug how-we-work new-slug     # renombrar (el slug anterior sigue redirigiendo)
mdl slug new-slug --clear         # volver al enlace permanente /p/<token>
```

La entrada `slug` de `update_page`, y `slug` en `publish_markdown`, hacen lo mismo
a través de MCP:

```json
{ "tool": "publish_markdown", "arguments": { "markdown": "# Hi\n", "slug": "how-we-work" } }
{ "tool": "update_page", "arguments": { "page": "<page>", "markdown": "# Hi v2\n", "slug": null } }
```

## Colecciones

Una colección es un conjunto ordenado y con nombre de páginas, con su propio enlace legible: la forma en que un
flujo de informes (estado diario, resúmenes de build) se reúne en un único lugar navegable, o en que un
documento de varias partes se mantiene en orden.

```bash
# crea una colección, opcionalmente con páginas iniciales (por URL o por nombre local --as)
mdl collection create daily-reports --title "Daily reports" --sort newest

# publica directamente en ella: la página pasa a ser el miembro más reciente
mdl publish report.md --collection daily-reports

# gestiona la pertenencia y los metadatos
mdl collection add daily-reports <page> --position 0
mdl collection rm daily-reports <page>
mdl collection get daily-reports            # el enlace de la colección, luego uno por página
mdl collection list                         # una línea por colección
mdl collection update daily-reports --title "Status reports" --slug status
mdl collection delete daily-reports
```

Las mismas operaciones son herramientas MCP: `create_collection`, `get_collection`,
`list_collections`, `update_collection`, `add_to_collection`, `remove_from_collection`,
`delete_collection`, además de `collection` en `publish_markdown`:

```json
{ "tool": "create_collection", "arguments": { "slug": "daily-reports", "title": "Daily reports", "sort": "newest" } }
{ "tool": "publish_markdown", "arguments": { "markdown": "# Monday\n", "collection": "daily-reports" } }
```

`<collection>` acepta un slug simple o una URL completa de colección; `<page>` acepta un token, una
URL o un nombre local `--as`: los nombres locales se resuelven en esta máquina, todo lo demás
se envía al servidor tal cual.

## Configuración y entorno

| Ajuste | Precedencia (gana la más alta) |
|---|---|
| URL del servidor | `--url` (solo CLI) → `MD_LANTERN_URL` → `config.json` → `https://md.vk0.dev` |
| Clave de API | `MD_LANTERN_API_KEY` → `config.json` → ninguna (anónimo) |
| Directorio de configuración | `MD_LANTERN_CONFIG_DIR` → `$XDG_CONFIG_HOME/md-lantern` → `~/.config/md-lantern` |

```bash
mdl config set-url https://md.vk0.dev
mdl config set-key mdl_...
mdl config show     # URL resuelta + origen, y una clave enmascarada: nunca la clave completa
mdl config unset-key
```

`config.json` y `pages.json` se crean con modo `0600` en un directorio `0700`, y se
escriben de forma atómica. Ningún comando imprime jamás la clave de API ni el token de gestión de ninguna página.

## Modo con clave vs. modo anónimo

| | Con clave de API | Sin clave |
|---|---|---|
| Publicar/actualizar | `POST/PUT /api/v1/...`, autenticado con Bearer | las mismas rutas anónimas `/publish` y `/p/:token/edit` que usa el editor del navegador |
| Propiedad | la clave es dueña de las páginas que publicó | un **token de gestión** recordado localmente es dueño de la página en esta máquina |
| `mdl list` | todas las páginas que esta clave ha publicado | solo las páginas recordadas localmente (esta máquina, este directorio de configuración) |
| `mdl versions` | funciona | requiere clave: el historial de versiones es una función ligada a la clave |

En ambos casos, `mdl get` siempre lee el `source.json` público de la página: no hace falta clave para
leer una página, solo para gestionarla.

## Referencia de herramientas (MCP)

| Herramienta | Propósito |
|---|---|
| `publish_markdown` | Publica markdown como una página nueva (o actualiza una vinculada por `name`); las entradas `slug` y `collection` están disponibles con clave |
| `update_page` | Edita una página existente en su lugar por token, URL o nombre; `slug` define, renombra o (con `null`) elimina su enlace legible |
| `get_page` | Lee de vuelta el markdown actual de una página y sus metadatos |
| `list_pages` | Lista las páginas de esta clave, o las páginas anónimas recordadas localmente |
| `delete_page` | Elimina una página de forma permanente |
| `list_versions` | Lista todas las versiones conservadas de una página, de la más nueva a la más antigua |
| `create_collection` | Crea una colección ordenada y con nombre de páginas, con su propio enlace |
| `get_collection` | Lee una colección y sus páginas miembro, en orden |
| `list_collections` | Lista las colecciones de esta clave |
| `update_collection` | Renombra, cambia el estilo o reordena una colección |
| `add_to_collection` | Añade una página a una colección, al final o en una posición |
| `remove_from_collection` | Quita una página de una colección (la página en sí no se toca) |
| `delete_collection` | Elimina una colección de forma permanente (las páginas miembro no se tocan) |

## Comparación

| | md-lantern-mcp | Gist | rentry.co | telegra.ph | Pegar en el chat |
|---|---|---|---|---|---|
| Nativo para agentes (herramientas MCP) | ✅ | ❌ | ❌ | ❌ | n/a |
| Gemelo `.md` sin procesar | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edición en su lugar, misma URL | ✅ | ✅ | ✅ | ❌ | ❌ |
| Se despliega como tarjeta en apps de chat | ✅ | parcial | parcial | ✅ | ❌ |
| CLI + MCP en un solo paquete | ✅ | ❌ | ❌ | ❌ | n/a |

## Preguntas frecuentes

**¿Es privada una página?** No. Toda página publicada es pública para cualquiera que tenga su URL;
no hay más control de acceso que el propio enlace. No publiques secretos.

**¿Qué pasa sin una clave de API?** Publicar sigue funcionando de forma anónima, por la misma vía
que usa el editor del navegador. Obtienes un "token de gestión" solo local en lugar de propiedad por clave,
recordado en `pages.json` en la máquina que lo publicó.

**¿Puedo apuntarlo a otro servidor MD Lantern?** Sí: la URL del servidor es
configurable. Define `MD_LANTERN_URL` (o ejecuta `mdl config set-url`) y el cliente habla con
cualquier servidor MD Lantern compatible al que tengas acceso.

**¿Actualizar una página rompe el enlace anterior?** No: `update_page` / `mdl update` editan la
página en su lugar. La URL se mantiene igual; el texto reemplazado pasa a ser una versión en el
historial público de la página.

**¿Por qué usaría un agente esto en lugar de responder directamente en el chat?** Los informes largos, las tablas
y los logs son costosos de releer en el historial y torpes de desplegar. Un enlace es barato
de pasar, y el gemelo `.md` sin procesar permite al siguiente agente leer el contenido exacto
sin volver a interpretar el formato del chat.

## Licencia

[MIT](./LICENSE) © vk0.dev
