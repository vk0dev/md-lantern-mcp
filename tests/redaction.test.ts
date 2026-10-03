import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ResolvedConfig } from '../src/core/config.js';
import { ApiError } from '../src/core/errors.js';
import * as ops from '../src/core/operations.js';
import { loadPagesStore, recordPublish, savePagesStore } from '../src/core/pagesStore.js';

const SECRET_KEY = 'mdl_super_secret_api_key_do_not_leak';
const SECRET_MANAGE_TOKEN = 'mt_super_secret_manage_token_do_not_leak';

function tmpCtx(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'mdl-redact-'));
  return {
    url: 'http://127.0.0.1:1',
    urlSource: 'env',
    apiKey: undefined,
    apiKeySource: 'none',
    configDir: dir,
    configFile: path.join(dir, 'config.json'),
    pagesFile: path.join(dir, 'pages.json'),
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('secret redaction', () => {
  it('never leaks the API key into a thrown ApiError, even when the request used it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })));
    const ctx = tmpCtx({ apiKey: SECRET_KEY, apiKeySource: 'env' });

    let caught: unknown;
    try {
      await ops.update('AbCdEfGh1234', '# x\n', {}, ctx);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    const err = caught as ApiError;
    expect(err.message).not.toContain(SECRET_KEY);
    expect(JSON.stringify(err)).not.toContain(SECRET_KEY);
    expect(JSON.stringify({ message: err.message, code: err.code, extra: err.extra })).not.toContain(SECRET_KEY);
  });

  it('never leaks a remembered manage token into a thrown ApiError in anonymous mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'bad_manage_token' }), { status: 403 })),
    );
    const ctx = tmpCtx();
    const store = recordPublish(loadPagesStore(ctx.pagesFile), {
      base: ctx.url,
      token: 'AbCdEfGh1234',
      url: `${ctx.url}/p/AbCdEfGh1234`,
      manageToken: SECRET_MANAGE_TOKEN,
      createdAt: new Date().toISOString(),
    });
    savePagesStore(ctx.pagesFile, store);

    let caught: unknown;
    try {
      await ops.update('AbCdEfGh1234', '# x\n', {}, ctx);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    const err = caught as ApiError;
    expect(err.message).not.toContain(SECRET_MANAGE_TOKEN);
    expect(JSON.stringify(err)).not.toContain(SECRET_MANAGE_TOKEN);
  });

  it('never includes the manage token in a successful publish result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              ok: true,
              token: 'AbCdEfGh1234',
              url: 'http://127.0.0.1:1/p/AbCdEfGh1234',
              title: 'Hi',
              version: 1,
              manageToken: SECRET_MANAGE_TOKEN,
            }),
            { status: 201 },
          ),
      ),
    );
    const ctx = tmpCtx();
    const result = await ops.publish('# Hi\n', {}, ctx);
    expect(result).not.toHaveProperty('manageToken');
    expect(JSON.stringify(result)).not.toContain(SECRET_MANAGE_TOKEN);
  });

  it('never includes manage tokens in the anonymous list result', async () => {
    const ctx = tmpCtx();
    const store = recordPublish(loadPagesStore(ctx.pagesFile), {
      base: ctx.url,
      token: 'AbCdEfGh1234',
      url: `${ctx.url}/p/AbCdEfGh1234`,
      manageToken: SECRET_MANAGE_TOKEN,
      createdAt: new Date().toISOString(),
    });
    savePagesStore(ctx.pagesFile, store);

    const result = await ops.list({}, ctx);
    expect(JSON.stringify(result)).not.toContain(SECRET_MANAGE_TOKEN);
  });
});
