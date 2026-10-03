import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_URL = 'https://md.vk0.dev';

export interface ConfigFileData {
  version: 1;
  url?: string;
  apiKey?: string;
}

export type UrlSource = 'flag' | 'env' | 'file' | 'default';
export type ApiKeySource = 'env' | 'file' | 'none';

export interface ResolvedConfig {
  url: string;
  urlSource: UrlSource;
  apiKey?: string;
  apiKeySource: ApiKeySource;
  configDir: string;
  configFile: string;
  pagesFile: string;
}

export interface ResolveConfigInput {
  cliUrl?: string;
  env?: Record<string, string | undefined>;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function resolveConfigDir(env: Record<string, string | undefined> = process.env): string {
  if (env.MD_LANTERN_CONFIG_DIR) return env.MD_LANTERN_CONFIG_DIR;
  if (env.XDG_CONFIG_HOME) return path.join(env.XDG_CONFIG_HOME, 'md-lantern');
  return path.join(os.homedir(), '.config', 'md-lantern');
}

export function ensureConfigDir(dir: string): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
}

/** Writes `data` to `file` atomically (tmp file in the same dir, then rename), mode 0600. */
export function atomicWriteFile(file: string, data: string): void {
  const dir = path.dirname(file);
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tmp, data, { mode: 0o600 });
  renameSync(tmp, file);
  chmodSync(file, 0o600);
}

export function readConfigFile(dir: string): ConfigFileData {
  const file = path.join(dir, 'config.json');
  if (!existsSync(file)) return { version: 1 };
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<ConfigFileData>;
    return { version: 1, url: parsed.url, apiKey: parsed.apiKey };
  } catch {
    return { version: 1 };
  }
}

export function writeConfigFile(dir: string, data: ConfigFileData): void {
  ensureConfigDir(dir);
  atomicWriteFile(path.join(dir, 'config.json'), JSON.stringify(data, null, 2) + '\n');
}

export function resolveConfig(input: ResolveConfigInput = {}): ResolvedConfig {
  const env = input.env ?? process.env;
  const configDir = resolveConfigDir(env);
  const fileConfig = readConfigFile(configDir);

  let url: string;
  let urlSource: UrlSource;
  if (input.cliUrl) {
    url = input.cliUrl;
    urlSource = 'flag';
  } else if (env.MD_LANTERN_URL) {
    url = env.MD_LANTERN_URL;
    urlSource = 'env';
  } else if (fileConfig.url) {
    url = fileConfig.url;
    urlSource = 'file';
  } else {
    url = DEFAULT_URL;
    urlSource = 'default';
  }

  let apiKey: string | undefined;
  let apiKeySource: ApiKeySource;
  if (env.MD_LANTERN_API_KEY) {
    apiKey = env.MD_LANTERN_API_KEY;
    apiKeySource = 'env';
  } else if (fileConfig.apiKey) {
    apiKey = fileConfig.apiKey;
    apiKeySource = 'file';
  } else {
    apiKeySource = 'none';
  }

  return {
    url: stripTrailingSlash(url),
    urlSource,
    apiKey,
    apiKeySource,
    configDir,
    configFile: path.join(configDir, 'config.json'),
    pagesFile: path.join(configDir, 'pages.json'),
  };
}

export function setUrl(configDir: string, url: string): void {
  const current = readConfigFile(configDir);
  writeConfigFile(configDir, { ...current, url: stripTrailingSlash(url) });
}

export function setKey(configDir: string, apiKey: string): void {
  const current = readConfigFile(configDir);
  writeConfigFile(configDir, { ...current, apiKey });
}

export function unsetKey(configDir: string): void {
  const current = readConfigFile(configDir);
  delete current.apiKey;
  writeConfigFile(configDir, { ...current });
}

export function maskKey(key: string | undefined): string {
  if (!key) return 'none';
  return `${key.slice(0, 8)}…`;
}
