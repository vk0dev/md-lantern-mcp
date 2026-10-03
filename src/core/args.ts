import { statSync } from 'node:fs';

import { UsageError } from './errors.js';

const COMMANDS = ['publish', 'update', 'get', 'list', 'versions', 'rm', 'config'] as const;
type KnownCommand = (typeof COMMANDS)[number];

const VALUE_FLAGS = new Set(['--title', '--style', '--expires', '--as', '--base-version', '--url', '--limit']);
const BOOL_FLAGS = new Set(['--breaks', '--json']);

export type FileExistsFn = (path: string) => boolean;

export const defaultFileExists: FileExistsFn = (path) => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

export interface PublishArgs {
  command: 'publish';
  file?: string;
  title?: string;
  style?: string;
  expires?: string;
  breaks: boolean;
  as?: string;
  json: boolean;
  url?: string;
}

export interface UpdateArgs {
  command: 'update';
  page: string;
  file?: string;
  title?: string;
  style?: string;
  baseVersion?: string;
  json: boolean;
  url?: string;
}

export interface GetArgs {
  command: 'get';
  page: string;
  json: boolean;
  url?: string;
}

export interface ListArgs {
  command: 'list';
  limit?: string;
  json: boolean;
  url?: string;
}

export interface VersionsArgs {
  command: 'versions';
  page: string;
  json: boolean;
  url?: string;
}

export interface RmArgs {
  command: 'rm';
  page: string;
  url?: string;
}

export type ConfigAction = 'show' | 'set-key' | 'set-url' | 'unset-key';

export interface ConfigArgs {
  command: 'config';
  action: ConfigAction;
  value?: string;
}

export interface VersionArgs {
  command: 'version';
}

export interface HelpArgs {
  command: 'help';
}

export type ParsedArgs =
  | PublishArgs
  | UpdateArgs
  | GetArgs
  | ListArgs
  | VersionsArgs
  | RmArgs
  | ConfigArgs
  | VersionArgs
  | HelpArgs;

function isKnownCommand(value: string | undefined): value is KnownCommand {
  return typeof value === 'string' && (COMMANDS as readonly string[]).includes(value);
}

interface Scanned {
  flags: Record<string, string>;
  bools: Record<string, boolean>;
  positionals: string[];
}

function scan(rest: string[]): Scanned {
  const flags: Record<string, string> = {};
  const bools: Record<string, boolean> = {};
  const positionals: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (VALUE_FLAGS.has(arg)) {
      const value = rest[++i];
      if (value === undefined) throw new UsageError(`${arg} requires a value`);
      flags[arg] = value;
    } else if (BOOL_FLAGS.has(arg)) {
      bools[arg] = true;
    } else {
      positionals.push(arg);
    }
  }
  return { flags, bools, positionals };
}

export function parseArgs(argv: string[], opts: { fileExists?: FileExistsFn } = {}): ParsedArgs {
  const fileExists = opts.fileExists ?? defaultFileExists;

  if (argv[0] === '--version') return { command: 'version' };
  if (argv[0] === '--help' || argv[0] === '-h') return { command: 'help' };

  let command: KnownCommand;
  let rest: string[];
  if (isKnownCommand(argv[0])) {
    command = argv[0];
    rest = argv.slice(1);
  } else if (
    argv.length === 0 ||
    argv[0] === '-' ||
    argv[0].startsWith('-') ||
    fileExists(argv[0])
  ) {
    command = 'publish';
    rest = argv;
  } else {
    throw new UsageError('unknown command or file');
  }

  if (command === 'config') {
    const action = rest[0];
    if (action !== 'show' && action !== 'set-key' && action !== 'set-url' && action !== 'unset-key') {
      throw new UsageError('usage: mdl config show|set-key KEY|set-url URL|unset-key');
    }
    return { command: 'config', action, value: rest[1] };
  }

  const { flags, bools, positionals } = scan(rest);

  if (command === 'publish') {
    return {
      command: 'publish',
      file: positionals[0],
      title: flags['--title'],
      style: flags['--style'],
      expires: flags['--expires'],
      breaks: !!bools['--breaks'],
      as: flags['--as'],
      json: !!bools['--json'],
      url: flags['--url'],
    };
  }

  if (command === 'update') {
    const page = positionals[0];
    if (page === undefined) throw new UsageError('update requires a PAGE argument');
    return {
      command: 'update',
      page,
      file: positionals[1],
      title: flags['--title'],
      style: flags['--style'],
      baseVersion: flags['--base-version'],
      json: !!bools['--json'],
      url: flags['--url'],
    };
  }

  if (command === 'get') {
    const page = positionals[0];
    if (page === undefined) throw new UsageError('get requires a PAGE argument');
    return { command: 'get', page, json: !!bools['--json'], url: flags['--url'] };
  }

  if (command === 'list') {
    return { command: 'list', limit: flags['--limit'], json: !!bools['--json'], url: flags['--url'] };
  }

  if (command === 'versions') {
    const page = positionals[0];
    if (page === undefined) throw new UsageError('versions requires a PAGE argument');
    return { command: 'versions', page, json: !!bools['--json'], url: flags['--url'] };
  }

  const page = positionals[0];
  if (page === undefined) throw new UsageError('rm requires a PAGE argument');
  return { command: 'rm', page, url: flags['--url'] };
}
