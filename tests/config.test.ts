import { mkdtempSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { maskKey, resolveConfig, resolveConfigDir, setKey, setUrl, unsetKey } from '../src/core/config.js';

function tmpDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'mdl-config-'));
}

describe('resolveConfigDir', () => {
  it('prefers MD_LANTERN_CONFIG_DIR', () => {
    expect(resolveConfigDir({ MD_LANTERN_CONFIG_DIR: '/custom/dir', XDG_CONFIG_HOME: '/xdg' })).toBe('/custom/dir');
  });

  it('falls back to $XDG_CONFIG_HOME/md-lantern', () => {
    expect(resolveConfigDir({ XDG_CONFIG_HOME: '/xdg' })).toBe(path.join('/xdg', 'md-lantern'));
  });

  it('falls back to ~/.config/md-lantern', () => {
    expect(resolveConfigDir({})).toBe(path.join(os.homedir(), '.config', 'md-lantern'));
  });
});

describe('resolveConfig URL precedence', () => {
  it('cli flag beats env, file, and default', () => {
    const dir = tmpDir();
    setUrl(dir, 'https://from-file.example');
    const resolved = resolveConfig({
      cliUrl: 'https://from-flag.example/',
      env: { MD_LANTERN_CONFIG_DIR: dir, MD_LANTERN_URL: 'https://from-env.example' },
    });
    expect(resolved.url).toBe('https://from-flag.example');
    expect(resolved.urlSource).toBe('flag');
  });

  it('env beats file and default, and strips a trailing slash', () => {
    const dir = tmpDir();
    setUrl(dir, 'https://from-file.example');
    const resolved = resolveConfig({ env: { MD_LANTERN_CONFIG_DIR: dir, MD_LANTERN_URL: 'https://from-env.example/' } });
    expect(resolved.url).toBe('https://from-env.example');
    expect(resolved.urlSource).toBe('env');
  });

  it('file beats default', () => {
    const dir = tmpDir();
    setUrl(dir, 'https://from-file.example/');
    const resolved = resolveConfig({ env: { MD_LANTERN_CONFIG_DIR: dir } });
    expect(resolved.url).toBe('https://from-file.example');
    expect(resolved.urlSource).toBe('file');
  });

  it('falls back to the default URL', () => {
    const dir = tmpDir();
    const resolved = resolveConfig({ env: { MD_LANTERN_CONFIG_DIR: dir } });
    expect(resolved.url).toBe('https://md.vk0.dev');
    expect(resolved.urlSource).toBe('default');
  });
});

describe('resolveConfig apiKey precedence', () => {
  it('env beats file', () => {
    const dir = tmpDir();
    setKey(dir, 'mdl_from_file');
    const resolved = resolveConfig({ env: { MD_LANTERN_CONFIG_DIR: dir, MD_LANTERN_API_KEY: 'mdl_from_env' } });
    expect(resolved.apiKey).toBe('mdl_from_env');
    expect(resolved.apiKeySource).toBe('env');
  });

  it('file is used when no env var is set', () => {
    const dir = tmpDir();
    setKey(dir, 'mdl_from_file');
    const resolved = resolveConfig({ env: { MD_LANTERN_CONFIG_DIR: dir } });
    expect(resolved.apiKey).toBe('mdl_from_file');
    expect(resolved.apiKeySource).toBe('file');
  });

  it('is none when neither is set', () => {
    const dir = tmpDir();
    const resolved = resolveConfig({ env: { MD_LANTERN_CONFIG_DIR: dir } });
    expect(resolved.apiKey).toBeUndefined();
    expect(resolved.apiKeySource).toBe('none');
  });

  it('unsetKey removes a previously set key', () => {
    const dir = tmpDir();
    setKey(dir, 'mdl_from_file');
    unsetKey(dir);
    const resolved = resolveConfig({ env: { MD_LANTERN_CONFIG_DIR: dir } });
    expect(resolved.apiKey).toBeUndefined();
  });
});

describe('config file permissions', () => {
  it('writes config.json with mode 0600 on POSIX', () => {
    if (process.platform === 'win32') return;
    const dir = tmpDir();
    setKey(dir, 'mdl_secret');
    const mode = statSync(path.join(dir, 'config.json')).mode;
    expect(mode & 0o077).toBe(0);
  });
});

describe('maskKey', () => {
  it('shows only the first 8 characters, then an ellipsis', () => {
    expect(maskKey('mdl_abcdefghijklmnop')).toBe('mdl_abcd…');
  });

  it('returns "none" for an absent key', () => {
    expect(maskKey(undefined)).toBe('none');
  });
});
