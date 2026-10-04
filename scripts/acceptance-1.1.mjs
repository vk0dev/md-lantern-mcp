#!/usr/bin/env node
// Operator acceptance for md-lantern-mcp 1.1.0: readable links and collections
// (written before the implementation card; scripts/acceptance.mjs still covers 1.0).
//
// Starts a real md-lantern server from MDL_REPO (it must have collections and slug-aware
// /api/v1/pages/:token, i.e. md-lantern 1.7 / wave-8), mints keys with its key CLI, and
// drives the built package: the `mdl` CLI as a child process, the MCP server over stdio
// through the official SDK client. Stops only the processes it started.
//
//   npm run build && MDL_REPO=/Users/vkdev/projects/md-lantern-dev-ops node scripts/acceptance-1.1.mjs
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
const { ok, step, report, startServer, mintKey, raw } = lib;

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
const lines = (s) => s.split('\n').filter(Boolean);

const dataDir = tmp('mdlmcp11-data-');
const srv = await startServer({ dataDir });
if (srv.exited !== null) { console.error('server failed to start:', srv.exited, srv.out()); process.exit(1); }
const BASE = srv.base;
const KEY_A = mintKey(dataDir, 'acceptance-a');
const KEY_B = mintKey(dataDir, 'acceptance-b');
const envA = { MD_LANTERN_URL: BASE, MD_LANTERN_API_KEY: KEY_A, MD_LANTERN_CONFIG_DIR: tmp('mdl-cfg-a-') };
const envB = { MD_LANTERN_URL: BASE, MD_LANTERN_API_KEY: KEY_B, MD_LANTERN_CONFIG_DIR: tmp('mdl-cfg-b-') };
const envAnon = { MD_LANTERN_URL: BASE, MD_LANTERN_CONFIG_DIR: tmp('mdl-cfg-anon-') };
const write = (body, name = 'doc.md') => { const f = path.join(tmp('mdl-src-'), name); fs.writeFileSync(f, body); return f; };
const api = (method, p, body, key = KEY_A) => raw(srv.port, method, p, { authorization: `Bearer ${key}` }, body);
const apiCol = async (slug) => (await api('GET', `/api/v1/collections/${slug}`)).json;

await step('package: 1.1.0 everywhere', async () => {
  ok(pkg.version === '1.1.0', 'package.json is 1.1.0');
  const plugin = JSON.parse(fs.readFileSync(path.join(PKG_DIR, '.claude-plugin/plugin.json'), 'utf8'));
  const server = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'server.json'), 'utf8'));
  const create = fs.readFileSync(path.join(PKG_DIR, 'src/createServer.ts'), 'utf8');
  ok(plugin.version === '1.1.0' && server.version === '1.1.0' && server.packages[0].version === '1.1.0', 'plugin.json and server.json are 1.1.0');
  ok(create.includes("'1.1.0'") || create.includes('"1.1.0"'), 'createServer.ts is 1.1.0');
  const changelog = fs.readFileSync(path.join(PKG_DIR, 'CHANGELOG.md'), 'utf8');
  ok(/^## \[1\.1\.0\]/m.test(changelog), 'CHANGELOG has a 1.1.0 entry');
  const readme = fs.readFileSync(path.join(PKG_DIR, 'README.md'), 'utf8');
  ok(/collection/i.test(readme) && /--collection/.test(readme) && /mdl collection/.test(readme), 'README documents collections and the CLI');
  ok(/--slug/.test(readme) && /mdl slug/.test(readme), 'README documents readable links');
  ok(!/self-hostable/i.test(readme), 'README does not promise "self-hostable" while the server repo is private');
  const h = await run(['--help']);
  for (const cmd of ['slug', 'collection']) ok(h.stdout.includes(cmd), `--help documents "${cmd}"`);
});

// --- CLI: readable links ------------------------------------------------------------------
let pSlugUrl;
await step('cli: publish --slug prints the readable link', async () => {
  const r = await run([write('# Как работаем\n\nДоговор и цены.\n'), '--slug', 'kak-rabotaem'], { env: envA });
  pSlugUrl = r.stdout.trim();
  ok(r.code === 0 && pSlugUrl === `${BASE}/kak-rabotaem`, `stdout is ${BASE}/kak-rabotaem (${pSlugUrl})`);
  ok((await raw(srv.port, 'GET', '/kak-rabotaem')).status === 200, 'the slug serves the page');
  const taken = await run([write('# Второй\n'), '--slug', 'kak-rabotaem'], { env: envA });
  ok(taken.code === 2 && taken.stderr.includes('slug_taken') && taken.stdout === '', 'a taken slug: exit 2 slug_taken, nothing on stdout');
  const bad = await run([write('# x\n'), '--slug', 'Bad Slug!'], { env: envA });
  ok(bad.code === 2 && bad.stderr.includes('bad_slug'), 'an invalid slug: exit 2 bad_slug (the server decides)');
  const anon = await run([write('# x\n'), '--slug', 'anon-slug'], { env: envAnon });
  ok(anon.code === 1 && /api key/i.test(anon.stderr) && anon.stdout === '', 'without a key: exit 1, stderr says an API key is needed');
  ok((await raw(srv.port, 'GET', '/anon-slug')).status === 404, '…and nothing was published under it');
});

await step('cli: a readable link works as a page reference', async () => {
  const g = await run(['get', pSlugUrl], { env: envA });
  ok(g.code === 0 && g.stdout === '# Как работаем\n\nДоговор и цены.\n', 'get by https://…/<slug> returns the markdown');
  const u = await run(['update', pSlugUrl, '-', '--json'], { env: envA, input: '# Как работаем\n\nДоговор, цены и сроки.\n' });
  const ju = json(u.stdout);
  ok(u.code === 0 && ju && ju.version === 2 && ju.url === pSlugUrl, 'update by the slug URL → v2, URL stays the slug');
  const v = await run(['versions', `${pSlugUrl}.md`], { env: envA });
  ok(v.code === 0 && lines(v.stdout).length >= 2, 'versions by the .md slug URL');
  // A slug URL this machine never published, read with another key.
  const gb = await run(['get', pSlugUrl], { env: envB });
  ok(gb.code === 0 && gb.stdout.includes('Договор, цены и сроки.'), 'another machine/key can read by the slug URL too');
});

await step('cli: mdl slug sets, renames and clears a page link', async () => {
  const p = await run([write('# Без адреса\n')], { env: envA });
  const url = p.stdout.trim();
  const s = await run(['slug', url, 'bez-adresa'], { env: envA });
  ok(s.code === 0 && s.stdout.trim() === `${BASE}/bez-adresa`, 'mdl slug <page> <slug> prints the new link');
  const r = await run(['slug', 'bez-adresa', 'novyi-adres'], { env: envA });
  ok(r.code === 0 && r.stdout.trim() === `${BASE}/novyi-adres`, 'a slug works as the page reference for mdl slug; rename prints the new link');
  const old = await raw(srv.port, 'GET', '/bez-adresa');
  ok(old.status === 301 && String(old.headers.location || '').endsWith('/novyi-adres'), 'the old slug redirects (301)');
  const c = await run(['slug', 'novyi-adres', '--clear'], { env: envA });
  ok(c.code === 0 && /\/p\/[A-Za-z0-9_-]+$/.test(c.stdout.trim()), '--clear prints the /p/ link again');
  const t = await run(['slug', url, 'kak-rabotaem'], { env: envA });
  ok(t.code === 2 && t.stderr.includes('slug_taken'), 'a taken slug: exit 2 slug_taken');
});

// --- CLI: collections ---------------------------------------------------------------------
const pages = {};
await step('cli: collection create / add / get / list', async () => {
  for (const [k, t] of [['a', 'Договор'], ['b', 'Цены'], ['c', 'Вопросы']]) {
    pages[k] = (await run(['--as', `client-${k}`, '-'], { env: envA, input: `# ${t}\n\nТекст.\n` })).stdout.trim();
  }
  const intro = write('Всё для клиентов в одном месте.\n');
  const c = await run(['collection', 'create', 'dlya-klientov', '--title', 'Для клиентов', '--intro-file', intro, '--style', 'book', pages.a, 'client-b'], { env: envA });
  ok(c.code === 0 && c.stdout.trim() === `${BASE}/dlya-klientov`, 'create prints the collection link');
  const col = await apiCol('dlya-klientov');
  ok(col && col.title === 'Для клиентов' && col.style === 'book' && col.intro.includes('Всё для клиентов'), 'title, style and intro reached the server');
  ok(col && col.pageCount === 2, 'pages given by URL and by local name are both members');
  const add = await run(['collection', 'add', `${BASE}/dlya-klientov`, 'client-c', '--position', '0'], { env: envA });
  ok(add.code === 0 && add.stdout.trim() === `${BASE}/dlya-klientov`, 'add by collection URL prints the collection link');
  const order = ((await apiCol('dlya-klientov'))?.pages || []).map((p) => p.url);
  ok(order[0] === pages.c && order.length === 3, '--position 0 puts the page first');
  const g = await run(['collection', 'get', 'dlya-klientov'], { env: envA });
  const gl = lines(g.stdout);
  ok(g.code === 0 && gl[0] === `${BASE}/dlya-klientov` && gl.length === 4 && gl.slice(1).every((l) => l.includes(BASE)), 'get: the collection link, then one line per page with its link');
  const gj = json((await run(['collection', 'get', 'dlya-klientov', '--json'], { env: envA })).stdout);
  ok(gj && gj.slug === 'dlya-klientov' && Array.isArray(gj.pages) && gj.pages.length === 3, 'get --json: the collection meta with pages');
  await run(['collection', 'create', 'otchety', '--title', 'Отчёты', '--sort', 'newest'], { env: envA });
  const l = await run(['collection', 'list'], { env: envA });
  ok(l.code === 0 && lines(l.stdout).length === 2 && l.stdout.includes(`${BASE}/dlya-klientov`) && l.stdout.includes(`${BASE}/otchety`), 'list: one line per collection with its link');
  const lj = json((await run(['collection', 'list', '--json'], { env: envA })).stdout);
  ok(lj && Array.isArray(lj.collections) && lj.collections.length === 2, 'list --json: {collections:[…]}');
});

await step('cli: publish --collection appends a report to a stream', async () => {
  const r = await run(['-', '--collection', 'otchety', '--json'], { env: envA, input: '# Отчёт за понедельник\n' });
  const j = json(r.stdout);
  ok(r.code === 0 && j && j.url, 'publish --collection succeeds');
  const col = await apiCol('otchety');
  ok(!!j && (col?.pages || []).some((p) => p.url === j.url), 'the page is in the collection');
  const missing = await run(['-', '--collection', 'net-takoi'], { env: envA, input: '# x\n' });
  ok(missing.code === 2 && missing.stderr.includes('collection_not_found'), 'unknown collection: exit 2 collection_not_found');
  const foreign = await run(['-', '--collection', 'otchety'], { env: envB, input: '# x\n' });
  ok(foreign.code === 2 && foreign.stderr.includes('forbidden'), "another key's collection: exit 2 forbidden");
  const named = await run(['--as', 'daily', '-', '--collection', 'otchety'], { env: envA, input: '# Daily v1\n' });
  await run(['--as', 'daily', '-', '--collection', 'otchety'], { env: envA, input: '# Daily v2\n' });
  const col2 = await apiCol('otchety');
  ok(named.code === 0 && (col2?.pages || []).filter((p) => p.url === named.stdout.trim()).length === 1, 'republishing a named page with --collection keeps one membership');
});

await step('cli: collection update / rm / delete; errors', async () => {
  const u = await run(['collection', 'update', 'dlya-klientov', '--title', 'Клиентам', '--slug', 'klientam', '--sort', 'manual'], { env: envA });
  ok(u.code === 0 && u.stdout.trim() === `${BASE}/klientam`, 'update with --slug prints the new link');
  ok((await apiCol('klientam'))?.title === 'Клиентам', 'the title changed');
  const old = await raw(srv.port, 'GET', '/dlya-klientov');
  ok(old.status === 301, 'the old collection slug redirects');
  const rm = await run(['collection', 'rm', 'klientam', 'client-c'], { env: envA });
  ok(rm.code === 0 && (await apiCol('klientam'))?.pageCount === 2, 'rm removes one member');
  const bad = await run(['collection', 'create', 'x', '--title', 'X'], { env: envA });
  ok(bad.code === 2 && bad.stderr.includes('bad_slug'), 'create with an invalid slug: exit 2 bad_slug');
  const noTitle = await run(['collection', 'create', 'bez-nazvaniya'], { env: envA });
  ok(noTitle.code === 1 || (noTitle.code === 2 && noTitle.stderr.includes('title_required')), 'create without --title is refused');
  const anon = await run(['collection', 'list'], { env: envAnon });
  ok(anon.code === 1 && /api key/i.test(anon.stderr), 'collections without a key: exit 1, stderr says an API key is needed');
  const d = await run(['collection', 'delete', 'klientam'], { env: envA });
  ok(d.code === 0 && (await api('GET', '/api/v1/collections/klientam')).status === 404, 'delete removes the collection');
  ok((await raw(srv.port, 'GET', new URL(pages.a).pathname)).status === 200, '…and leaves its pages alone');
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
const COLLECTION_TOOLS = ['create_collection', 'get_collection', 'list_collections', 'update_collection', 'add_to_collection', 'remove_from_collection', 'delete_collection'];

await step('mcp: catalogue', async () => {
  const c = await mcp({ ...envA, MD_LANTERN_CONFIG_DIR: tmp('mdl-cfg-m0-') });
  ok(c.getServerVersion()?.version === '1.1.0', 'serverInfo version 1.1.0');
  const { tools } = await c.listTools();
  const names = tools.map((t) => t.name);
  for (const n of COLLECTION_TOOLS) ok(names.includes(n), `tool ${n} is listed`);
  ok(names.length === 13, `13 tools in all (${names.length})`);
  for (const t of tools) ok((t.description || '').length >= 80, `${t.name} description is at least 80 chars`);
  const pub = tools.find((t) => t.name === 'publish_markdown');
  ok(pub && pub.inputSchema.properties.slug && pub.inputSchema.properties.collection, 'publish_markdown takes slug and collection');
  const upd = tools.find((t) => t.name === 'update_page');
  ok(upd && upd.inputSchema.properties.slug, 'update_page takes slug');
  ok(/collection/i.test(c.getInstructions() || ''), 'the server instructions mention collections');
  await c.close();
});

await step('mcp: a report stream in a collection', async () => {
  const c = await mcp({ ...envA, MD_LANTERN_CONFIG_DIR: tmp('mdl-cfg-m1-') });
  const cr = await c.callTool({ name: 'create_collection', arguments: { slug: 'agent-reports', title: 'Agent reports', intro: 'Daily output.', sort: 'newest' } });
  const cs = cr.structuredContent || {};
  ok(!cr.isError && cs.url === `${BASE}/agent-reports` && text(cr).includes(cs.url), 'create_collection returns the collection URL in text and structuredContent');
  const p1 = await c.callTool({ name: 'publish_markdown', arguments: { markdown: '# Monday\n', collection: 'agent-reports' } });
  const p2 = await c.callTool({ name: 'publish_markdown', arguments: { markdown: '# Tuesday\n', collection: `${BASE}/agent-reports`, slug: 'tuesday-report' } });
  ok(!p1.isError && !p2.isError, 'publish_markdown with collection (slug or URL) succeeds');
  ok(p2.structuredContent?.url === `${BASE}/tuesday-report`, 'publish_markdown with slug returns the readable link');
  const g = await c.callTool({ name: 'get_collection', arguments: { collection: 'agent-reports' } });
  const gp = g.structuredContent?.pages || [];
  ok(!g.isError && gp.length === 2 && gp[0].url === `${BASE}/tuesday-report`, 'get_collection lists both, newest first');
  ok(gp.every((p) => p.url && p.title && p.token), 'each page has url, title and token');
  const l = await c.callTool({ name: 'list_collections', arguments: {} });
  ok(!l.isError && (l.structuredContent?.collections || []).some((x) => x.slug === 'agent-reports'), 'list_collections includes it');
  const gpByUrl = await c.callTool({ name: 'get_page', arguments: { page: `${BASE}/tuesday-report` } });
  ok(!gpByUrl.isError && gpByUrl.structuredContent?.markdown === '# Tuesday\n', 'get_page takes a readable link');
  const us = await c.callTool({ name: 'update_page', arguments: { page: `${BASE}/tuesday-report`, markdown: '# Tuesday\n\nedited\n', slug: 'vtornik' } });
  ok(!us.isError && us.structuredContent?.url === `${BASE}/vtornik` && us.structuredContent?.version === 2, 'update_page can rename the slug and edit in one call');
  await c.close();
});

await step('mcp: manual order, update, remove, delete', async () => {
  const c = await mcp({ ...envA, MD_LANTERN_CONFIG_DIR: tmp('mdl-cfg-m2-') });
  const urls = [];
  for (const t of ['Part 1', 'Part 2', 'Part 3']) urls.push((await c.callTool({ name: 'publish_markdown', arguments: { markdown: `# ${t}\n` } })).structuredContent?.url);
  const cr = await c.callTool({ name: 'create_collection', arguments: { slug: 'guide', title: 'Guide', pages: [urls[0], urls[2]] } });
  ok(!cr.isError && cr.structuredContent?.pageCount === 2, 'create_collection with pages');
  const add = await c.callTool({ name: 'add_to_collection', arguments: { collection: 'guide', page: urls[1], position: 1 } });
  ok(!add.isError && JSON.stringify((add.structuredContent?.pages || []).map((p) => p.url)) === JSON.stringify(urls), 'add_to_collection at position 1 restores the order');
  const again = await c.callTool({ name: 'add_to_collection', arguments: { collection: 'guide', page: urls[1] } });
  ok(!again.isError && again.structuredContent?.pageCount === 3, 'adding the same page again is a no-op');
  const up = await c.callTool({ name: 'update_collection', arguments: { collection: 'guide', title: 'The guide', style: 'docs', pages: [urls[2], urls[1], urls[0]] } });
  ok(!up.isError && up.structuredContent?.title === 'The guide' && up.structuredContent?.pages?.[0]?.url === urls[2], 'update_collection changes fields and replaces the order');
  const rm = await c.callTool({ name: 'remove_from_collection', arguments: { collection: 'guide', page: urls[1] } });
  ok(!rm.isError && (await apiCol('guide'))?.pageCount === 2, 'remove_from_collection');
  const foreign = await mcp({ ...envB, MD_LANTERN_CONFIG_DIR: tmp('mdl-cfg-m3-') });
  const fb = await foreign.callTool({ name: 'add_to_collection', arguments: { collection: 'guide', page: urls[1] } });
  ok(fb.isError === true && text(fb).includes('forbidden'), "another key: isError naming forbidden");
  await foreign.close();
  const bad = await c.callTool({ name: 'create_collection', arguments: { slug: 'guide', title: 'Dup' } });
  ok(bad.isError === true && text(bad).includes('slug_taken'), 'a taken slug: isError naming slug_taken');
  const del = await c.callTool({ name: 'delete_collection', arguments: { collection: 'guide' } });
  ok(!del.isError && (await api('GET', '/api/v1/collections/guide')).status === 404, 'delete_collection');
  const gone = await c.callTool({ name: 'get_collection', arguments: { collection: 'guide' } });
  ok(gone.isError === true && text(gone).includes('not_found'), 'get_collection after delete: isError naming not_found');
  await c.close();
});

await step('mcp: without a key', async () => {
  const c = await mcp({ ...envAnon, MD_LANTERN_CONFIG_DIR: tmp('mdl-cfg-m4-') });
  const r = await c.callTool({ name: 'list_collections', arguments: {} });
  ok(r.isError === true && text(r).includes('api_key_required'), 'collection tools: isError naming api_key_required');
  const s = await c.callTool({ name: 'publish_markdown', arguments: { markdown: '# x\n', slug: 'anon-mcp' } });
  ok(s.isError === true && text(s).includes('api_key_required'), 'publish_markdown with slug: isError naming api_key_required');
  ok((await raw(srv.port, 'GET', '/anon-mcp')).status === 404, '…and nothing was published');
  const plain = await c.callTool({ name: 'publish_markdown', arguments: { markdown: '# Still works\n' } });
  ok(!plain.isError, 'a plain anonymous publish still works');
  await c.close();
});

report('md-lantern-mcp 1.1 acceptance');
