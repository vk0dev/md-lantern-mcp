#!/usr/bin/env node
// Operator acceptance for md-lantern-mcp (written before the implementation card).
//
// Starts a real md-lantern server from a checkout (MDL_REPO, default the dev clone) on a
// free loopback port against a throwaway data dir, mints API keys with its real key CLI,
// and drives the built package end to end: the `mdl` CLI as a child process, and the MCP
// server over stdio through the official SDK client. Stops only the processes it started.
//
//   npm run build && node scripts/acceptance.mjs
//
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.resolve(HERE, '..');
const MDL_REPO = path.resolve(process.env.MDL_REPO || '/Users/vkdev/projects/md-lantern-dev');
const lib = await import(pathToFileURL(path.join(MDL_REPO, 'scripts/acceptance/_lib.mjs')).href);
const { ok, step, report, startServer, mintKey, freePort, raw } = lib;

const pkg = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8'));
const CLI = path.join(PKG_DIR, 'dist/cli.js');
const SERVER = path.join(PKG_DIR, 'dist/server.js');
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

function run(args, { env = {}, input } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd: tmp('mdl-cwd-'),
      env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const t = setTimeout(() => { try { child.kill(); } catch {} }, 20000);
    child.on('close', (code) => { clearTimeout(t); resolve({ code, stdout, stderr }); });
    if (input !== undefined) child.stdin.end(input); else child.stdin.end();
  });
}
const json = (s) => { try { return JSON.parse(s); } catch { return null; } };
const tokenOf = (url) => (String(url).match(/\/p\/([A-Za-z0-9_-]+)$/) || [])[1];

// ---------------------------------------------------------------------------------------
const dataDir = tmp('mdlmcp-data-');
const srv = await startServer({ dataDir, env: { MD_LANTERN_MAX_CHARS: '5000' } });
if (srv.exited !== null) { console.error('server failed to start:', srv.exited, srv.out()); process.exit(1); }
const BASE = srv.base;
const KEY_A = mintKey(dataDir, 'acceptance-a');
const KEY_B = mintKey(dataDir, 'acceptance-b');
const cfgA = tmp('mdl-cfg-a-');
const envA = { MD_LANTERN_URL: BASE, MD_LANTERN_API_KEY: KEY_A, MD_LANTERN_CONFIG_DIR: cfgA };
const src = (p) => { const f = path.join(tmp('mdl-src-'), p); return f; };
const write = (body, name = 'doc.md') => { const f = src(name); fs.writeFileSync(f, body); return f; };
const source = async (token) => (await raw(srv.port, 'GET', `/p/${token}/source.json`)).json;
const apiPage = async (token, key = KEY_A) => (await raw(srv.port, 'GET', `/api/v1/pages/${token}`, { authorization: `Bearer ${key}` })).json;

let t1; // the main page token, published from a file
let t1Url;

await step('package metadata', async () => {
  ok(pkg.name === '@vk0/md-lantern-mcp', 'package name is @vk0/md-lantern-mcp');
  ok(pkg.version === '1.0.0', 'first release is 1.0.0');
  ok(pkg.bin && pkg.bin.mdl && pkg.bin['md-lantern-mcp'], 'two bins: mdl and md-lantern-mcp');
  ok(pkg.mcpName === 'io.github.vk0dev/md-lantern-mcp', 'mcpName');
  ok(Array.isArray(pkg.keywords) && pkg.keywords.length >= 10, 'keywords >= 10');
  const plugin = JSON.parse(fs.readFileSync(path.join(PKG_DIR, '.claude-plugin/plugin.json'), 'utf8'));
  const server = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'server.json'), 'utf8'));
  const create = fs.readFileSync(path.join(PKG_DIR, 'src/createServer.ts'), 'utf8');
  ok(plugin.version === pkg.version && server.version === pkg.version && server.packages[0].version === pkg.version, 'plugin.json/server.json versions match package.json');
  ok(create.includes(`'${pkg.version}'`) || create.includes(`"${pkg.version}"`), 'createServer.ts carries the same version');
  ok(fs.existsSync(CLI) && fs.existsSync(SERVER), 'dist/cli.js and dist/server.js are built');
  const readme = fs.readFileSync(path.join(PKG_DIR, 'README.md'), 'utf8');
  const firstH2 = (readme.match(/^##\s+(.+)$/m) || [])[1] || '';
  ok(/why|when/i.test(firstH2), 'README opens with a Why / When to use section');
  for (const client of ['Claude Code', 'Claude Desktop', 'Cursor', 'Cline']) ok(readme.includes(client), `README has an install snippet for ${client}`);
  ok(!/\{\{|TODO|lorem/i.test(readme), 'README has no template leftovers');
});

// --- CLI ---------------------------------------------------------------------------------
await step('cli: --version / --help', async () => {
  const v = await run(['--version']);
  ok(v.code === 0 && v.stdout.trim() === pkg.version, '--version prints the package version');
  const h = await run(['--help']);
  ok(h.code === 0, '--help exits 0');
  for (const cmd of ['publish', 'update', 'get', 'list', 'versions', 'rm', 'config']) ok(h.stdout.includes(cmd), `--help documents "${cmd}"`);
  const u = await run(['frobnicate'], { env: envA });
  ok(u.code === 1 && u.stderr.length > 0 && u.stdout === '', 'unknown command: exit 1, message on stderr only');
});

await step('cli: publish a file prints exactly the URL', async () => {
  const f = write('# Weekly status\n\nAll systems nominal.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n');
  const r = await run([f], { env: envA });
  t1Url = r.stdout.trim();
  t1 = tokenOf(t1Url);
  ok(r.code === 0 && !!t1, 'exit 0');
  ok(r.stdout.split('\n').filter(Boolean).length === 1 && t1Url.startsWith(`${BASE}/p/`) && !!t1, 'stdout is one line: the page URL');
  const page = await raw(srv.port, 'GET', `/p/${t1}`);
  ok(page.status === 200 && page.text.includes('Weekly status'), 'the page is live');
  const meta = await apiPage(t1);
  ok(meta && meta.version === 1, 'published as v1 through the API key');
  const listed = (await raw(srv.port, 'GET', '/api/v1/pages', { authorization: `Bearer ${KEY_A}` })).json;
  ok(listed && listed.pages.some((p) => p.token === t1), 'the page belongs to the key (listed by GET /api/v1/pages)');
});

await step('cli: explicit publish verb, stdin, flags, --json', async () => {
  const r = await run(['publish', '-', '--title', 'Piped in', '--style', 'book', '--expires', '7d', '--json'], { env: envA, input: 'just a line from stdin\n' });
  const j = json(r.stdout);
  ok(r.code === 0 && j, '--json prints a JSON object');
  ok(j && j.url && j.token && j.title === 'Piped in' && j.version === 1, 'JSON carries url/token/title/version');
  ok(j && j.action === 'created', 'JSON action is "created"');
  ok(!!j && !r.stdout.includes('manageToken') && !r.stderr.includes('manageToken'), 'the manage token is never printed');
  const meta = j && await apiPage(j.token);
  ok(meta && meta.style === 'book', '--style book reached the page');
  const exp = meta && Date.parse(meta.expiresAt);
  ok(exp && Math.abs(exp - (Date.now() + 7 * 864e5)) < 36e5, '--expires 7d set expiresAt about a week out');
  const s = await run([], { env: envA, input: '# From stdin without a dash\n' });
  ok(s.code === 0 && s.stdout.trim().startsWith(`${BASE}/p/`), 'no file argument + piped stdin publishes stdin');
});

await step('cli: errors are coded, on stderr, with exit 2', async () => {
  const bad = await run([write('# x\n'), '--style', 'gothic'], { env: envA });
  ok(bad.code === 2 && bad.stdout === '' && bad.stderr.includes('bad_style'), 'bad style: exit 2, stderr names bad_style, stdout empty');
  const big = await run([write('# big\n\n' + 'word '.repeat(1500))], { env: envA });
  ok(big.code === 2 && big.stderr.includes('too_large'), 'over MD_LANTERN_MAX_CHARS: exit 2 too_large');
  const empty = await run(['-'], { env: envA, input: '   \n' });
  ok(empty.code !== 0 && empty.stdout === '' && empty.stderr.length > 0, 'blank input is refused with a message');
  const badKey = await run([write('# x\n')], { env: { ...envA, MD_LANTERN_API_KEY: 'mdl_nope' } });
  ok(badKey.code === 2 && badKey.stderr.includes('unauthorized'), 'a wrong key: exit 2 unauthorized');
  const closed = await freePort();
  const net = await run([write('# x\n')], { env: { ...envA, MD_LANTERN_URL: `http://127.0.0.1:${closed}` } });
  ok(net.code === 3 && net.stderr.length > 0, 'server unreachable: exit 3');
});

await step('cli: update in place by token, URL and .md URL', async () => {
  const f2 = write('# Weekly status\n\nOne incident on Tuesday.\n');
  const r = await run(['update', t1, f2], { env: envA });
  ok(r.code === 0 && r.stdout.trim() === t1Url, 'update prints the same URL');
  const s = await source(t1);
  ok(s && s.version === 2 && s.markdown === fs.readFileSync(f2, 'utf8'), 'the page now serves the new text as v2');
  const r2 = await run(['update', t1Url, '-', '--json'], { env: envA, input: '# Weekly status\n\nResolved.\n' });
  const j2 = json(r2.stdout);
  ok(r2.code === 0 && j2 && j2.version === 3 && j2.action === 'updated', 'update by page URL → v3, action "updated"');
  const r3 = await run(['update', `${t1Url}.md`, '-', '--json'], { env: envA, input: '# Weekly status\n\nResolved.\n' });
  const j3 = json(r3.stdout);
  ok(r3.code === 0 && j3 && j3.changed === false && j3.version === 3 && j3.action === 'unchanged', 'same text again → changed:false, still v3');
  const conflict = await run(['update', t1, '-', '--base-version', '1'], { env: envA, input: '# stale\n' });
  ok(conflict.code === 2 && conflict.stderr.includes('version_conflict') && conflict.stderr.includes('3'), 'stale --base-version: exit 2 version_conflict naming the current version');
});

await step('cli: --as keeps one stable link for a recurring report', async () => {
  const a = await run(['--as', 'daily-report', '-'], { env: envA, input: '# Daily\n\nMonday.\n' });
  const b = await run(['--as', 'daily-report', '-', '--json'], { env: envA, input: '# Daily\n\nTuesday.\n' });
  const jb = json(b.stdout);
  ok(a.code === 0 && jb && jb.url === a.stdout.trim(), 'second publish with the same name returns the same URL');
  ok(jb && jb.version === 2 && jb.action === 'updated', '…as v2 of that page');
  const c = await run(['--as', 'daily-report', '-', '--json'], { env: envA, input: '# Daily\n\nTuesday.\n' });
  ok(json(c.stdout)?.action === 'unchanged', 'same content under the same name → unchanged');
  const viaName = await run(['get', 'daily-report'], { env: envA });
  ok(viaName.code === 0 && viaName.stdout === '# Daily\n\nTuesday.\n', 'a name works as a page reference for get');
  const bad = await run(['--as', 'Bad Name!', '-'], { env: envA, input: '# x\n' });
  ok(bad.code === 1, 'an invalid name is a usage error (exit 1)');
  // The bound page disappears server-side → the name re-binds to a fresh page.
  const tok = tokenOf(a.stdout.trim());
  await raw(srv.port, 'DELETE', `/api/v1/pages/${tok}`, { authorization: `Bearer ${KEY_A}` });
  const d = await run(['--as', 'daily-report', '-', '--json'], { env: envA, input: '# Daily\n\nWednesday.\n' });
  const jd = json(d.stdout);
  ok(d.code === 0 && jd && jd.action === 'created' && jd.token !== tok, 'a name whose page was deleted publishes a new page and re-binds');
});

await step('cli: get, list, versions, rm', async () => {
  const g = await run(['get', t1], { env: envA });
  ok(g.code === 0 && g.stdout === '# Weekly status\n\nResolved.\n', 'get prints the exact current markdown');
  const gj = json((await run(['get', t1, '--json'], { env: envA })).stdout);
  ok(gj && gj.version === 3 && gj.url === t1Url && typeof gj.markdown === 'string', 'get --json has url/version/markdown');
  const l = json((await run(['list', '--json'], { env: envA })).stdout);
  ok(Array.isArray(l?.pages) && l.pages.some((p) => p.token === t1), 'list --json includes the page');
  const lt = await run(['list'], { env: envA });
  ok(lt.code === 0 && lt.stdout.includes(t1Url), 'list (text) shows page URLs');
  const v = json((await run(['versions', t1, '--json'], { env: envA })).stdout);
  ok(Array.isArray(v?.versions) && v.versions.length === 3 && v.versions[0].current === true, 'versions --json lists 3 versions, newest (current) first');
  const del = await run(['rm', t1], { env: envA });
  ok(!!t1 && del.code === 0, 'rm exits 0');
  ok(!!t1 && (await raw(srv.port, 'GET', `/p/${t1}`)).status === 404, 'the page is gone');
  const again = await run(['get', t1], { env: envA });
  ok(again.code === 2 && again.stderr.includes('not_found'), 'get after rm: exit 2 not_found');
});

await step('cli: another key cannot edit or delete without the manage token', async () => {
  const p = await run([write('# Owned by A\n')], { env: envA });
  const tok = tokenOf(p.stdout.trim());
  const envB = { MD_LANTERN_URL: BASE, MD_LANTERN_API_KEY: KEY_B, MD_LANTERN_CONFIG_DIR: tmp('mdl-cfg-b-') };
  const u = await run(['update', tok, '-'], { env: envB, input: '# hijack\n' });
  ok(u.code === 2 && u.stderr.includes('forbidden'), 'key B update → forbidden');
  const d = await run(['rm', tok], { env: envB });
  ok(d.code === 2 && d.stderr.includes('forbidden'), 'key B rm → forbidden');
  ok((await source(tok))?.markdown === '# Owned by A\n', 'the page is untouched');
});

await step('cli: anonymous mode (no key) uses the browser publish path', async () => {
  const cfg = tmp('mdl-cfg-anon-');
  const env = { MD_LANTERN_URL: BASE, MD_LANTERN_CONFIG_DIR: cfg };
  const p = await run(['-'], { env, input: '# Anonymous\n\nNo key here.\n' });
  const url = p.stdout.trim();
  const tok = tokenOf(url);
  ok(p.code === 0 && tok, 'publish without a key works');
  const pagesFile = path.join(cfg, 'pages.json');
  ok(fs.existsSync(pagesFile), 'pages.json is written to MD_LANTERN_CONFIG_DIR');
  ok(fs.existsSync(pagesFile) && (fs.statSync(pagesFile).mode & 0o077) === 0, 'pages.json is private (mode 0600)');
  ok(fs.existsSync(pagesFile) && fs.readFileSync(pagesFile, 'utf8').includes(tok), 'pages.json remembers the page');
  const u = await run(['update', tok, '-'], { env, input: '# Anonymous\n\nEdited.\n' });
  ok(u.code === 0 && (await source(tok))?.version === 2, 'update works through the remembered manage token');
  const l = await run(['list'], { env });
  ok(l.code === 0 && l.stdout.includes(url), 'list shows locally remembered pages');
  const v = await run(['versions', tok], { env });
  ok(v.code !== 0 && /key/i.test(v.stderr), 'versions without a key explains that it needs an API key');
  const foreign = await run(['update', tok, '-'], { env: { MD_LANTERN_URL: BASE, MD_LANTERN_CONFIG_DIR: tmp('mdl-cfg-x-') }, input: '# x\n' });
  ok(foreign.code !== 0 && foreign.stderr.length > 0, 'a machine that did not publish the page cannot edit it');
  const d = await run(['rm', tok], { env });
  ok(!!tok && d.code === 0 && (await raw(srv.port, 'GET', `/p/${tok}`)).status === 404, 'rm deletes it');
  ok(!fs.readFileSync(pagesFile, 'utf8').includes(tok), 'and forgets it locally');
});

await step('cli: config never shows the whole key', async () => {
  const cfg = tmp('mdl-cfg-conf-');
  const env = { MD_LANTERN_URL: BASE, MD_LANTERN_CONFIG_DIR: cfg };
  const set = await run(['config', 'set-key', KEY_A], { env });
  ok(set.code === 0 && !set.stdout.includes(KEY_A) && !set.stderr.includes(KEY_A), 'set-key does not echo the key');
  const cfgFile = path.join(cfg, 'config.json');
  ok(fs.existsSync(cfgFile) && (fs.statSync(cfgFile).mode & 0o077) === 0, 'config.json is private (mode 0600)');
  const show = await run(['config', 'show'], { env });
  ok(show.code === 0 && show.stdout.includes(BASE) && !show.stdout.includes(KEY_A), 'show prints the URL and a masked key');
  const p = await run(['-'], { env, input: '# Key from the config file\n' });
  const tok = tokenOf(p.stdout.trim());
  ok(p.code === 0 && (await apiPage(tok))?.version === 1 && (await raw(srv.port, 'GET', '/api/v1/pages', { authorization: `Bearer ${KEY_A}` })).json.pages.some((x) => x.token === tok), 'a key from config.json is used (page owned by that key)');
});

// --- MCP ---------------------------------------------------------------------------------
const sdkClient = pathToFileURL(path.join(PKG_DIR, 'node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js')).href;
const sdkStdio = pathToFileURL(path.join(PKG_DIR, 'node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js')).href;
const { Client } = await import(sdkClient);
const { StdioClientTransport } = await import(sdkStdio);

async function mcp(env) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [SERVER], env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env }, stderr: 'pipe' });
  const client = new Client({ name: 'acceptance', version: '0.0.0' });
  await client.connect(transport);
  return client;
}
const text = (res) => (res.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
const TOOLS = ['publish_markdown', 'update_page', 'get_page', 'list_pages', 'delete_page', 'list_versions'];

await step('mcp: handshake and tool catalogue', async () => {
  const c = await mcp({ ...envA, MD_LANTERN_CONFIG_DIR: tmp('mdl-cfg-m0-') });
  const info = c.getServerVersion();
  ok(info && info.name === 'md-lantern-mcp' && info.version === pkg.version, 'serverInfo name/version');
  const { tools } = await c.listTools();
  const names = tools.map((t) => t.name);
  for (const n of TOOLS) ok(names.includes(n), `tool ${n} is listed`);
  for (const t of tools) ok((t.description || '').length >= 80, `${t.name} description is at least 80 chars`);
  const pub = tools.find((t) => t.name === 'publish_markdown');
  ok(pub && (pub.inputSchema.required || []).includes('markdown'), 'publish_markdown requires markdown');
  ok(pub && pub.inputSchema.properties.style && JSON.stringify(pub.inputSchema.properties.style).includes('book'), 'publish_markdown style lists the reading styles');
  ok(typeof c.getInstructions() === 'string' && c.getInstructions().length > 40, 'server sends usage instructions');
  await c.close();
});

await step('mcp: publish, name, get, update, conflict, versions, list, delete', async () => {
  const c = await mcp({ ...envA, MD_LANTERN_CONFIG_DIR: tmp('mdl-cfg-m1-') });
  const r = await c.callTool({ name: 'publish_markdown', arguments: { markdown: '# MCP page\n\nHello from a tool call.\n', style: 'docs' } });
  const sc = r.structuredContent || {};
  ok(!r.isError && sc.url && text(r).includes(sc.url), 'publish_markdown returns the URL in text and structuredContent');
  const tok = sc.token;
  ok(tok && (await apiPage(tok))?.style === 'docs', 'the page is live with the requested style');
  ok(!r.isError && !!tok && !JSON.stringify(r).includes('manageToken'), 'no manage token in the tool result');

  const n1 = await c.callTool({ name: 'publish_markdown', arguments: { markdown: '# Status\n\nv1\n', name: 'status-board' } });
  const n2 = await c.callTool({ name: 'publish_markdown', arguments: { markdown: '# Status\n\nv2\n', name: 'status-board' } });
  ok(n1.structuredContent?.url && n1.structuredContent.url === n2.structuredContent?.url && n2.structuredContent.version === 2, 'publish_markdown with the same name updates the same page');

  const g = await c.callTool({ name: 'get_page', arguments: { page: sc.url } });
  ok(!g.isError && g.structuredContent?.markdown === '# MCP page\n\nHello from a tool call.\n' && g.structuredContent.version === 1, 'get_page by URL returns the markdown and version');

  const u = await c.callTool({ name: 'update_page', arguments: { page: tok, markdown: '# MCP page\n\nEdited.\n', base_version: 1 } });
  ok(!u.isError && u.structuredContent?.version === 2 && u.structuredContent.url === sc.url, 'update_page with the right base_version → v2, same URL');
  const stale = await c.callTool({ name: 'update_page', arguments: { page: tok, markdown: '# stale\n', base_version: 1 } });
  ok(stale.isError === true && text(stale).includes('version_conflict') && text(stale).includes('2'), 'stale base_version → isError naming version_conflict and the current version');

  const v = await c.callTool({ name: 'list_versions', arguments: { page: tok } });
  ok(!v.isError && Array.isArray(v.structuredContent?.versions) && v.structuredContent.versions.length === 2, 'list_versions returns both versions');
  const l = await c.callTool({ name: 'list_pages', arguments: {} });
  ok(!l.isError && (l.structuredContent?.pages || []).some((p) => p.token === tok), 'list_pages includes the page');

  const bad = await c.callTool({ name: 'publish_markdown', arguments: { markdown: '# x\n', style: 'gothic' } });
  ok(bad.isError === true, 'an invalid style is an error result (schema or server)');

  const d = await c.callTool({ name: 'delete_page', arguments: { page: tok } });
  ok(!d.isError && (await raw(srv.port, 'GET', `/p/${tok}`)).status === 404, 'delete_page removes the page');
  const gone = await c.callTool({ name: 'get_page', arguments: { page: tok } });
  ok(gone.isError === true && text(gone).includes('not_found'), 'get_page after delete → isError not_found');
  await c.close();
});

await step('mcp: works without a key (anonymous publish)', async () => {
  const c = await mcp({ MD_LANTERN_URL: BASE, MD_LANTERN_CONFIG_DIR: tmp('mdl-cfg-m2-') });
  const r = await c.callTool({ name: 'publish_markdown', arguments: { markdown: '# Anonymous via MCP\n' } });
  const tok = r.structuredContent?.token;
  ok(!r.isError && tok && (await raw(srv.port, 'GET', `/p/${tok}`)).status === 200, 'anonymous publish_markdown works');
  const u = await c.callTool({ name: 'update_page', arguments: { page: tok, markdown: '# Anonymous via MCP\n\nedited\n' } });
  ok(!u.isError && u.structuredContent?.version === 2, 'and the same server process can edit what it published');
  await c.close();
});

report('md-lantern-mcp acceptance');
