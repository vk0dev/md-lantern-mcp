import { describe, expect, it } from 'vitest';

import { parseArgs } from '../src/core/args.js';
import { UsageError } from '../src/core/errors.js';

const noFiles = { fileExists: () => false };
const fileAt = (p: string) => ({ fileExists: (candidate: string) => candidate === p });

describe('parseArgs', () => {
  it('parses --version and --help', () => {
    expect(parseArgs(['--version'])).toEqual({ command: 'version' });
    expect(parseArgs(['--help'])).toEqual({ command: 'help' });
    expect(parseArgs(['-h'])).toEqual({ command: 'help' });
  });

  it('treats an empty argv as an implicit publish reading stdin', () => {
    const parsed = parseArgs([], noFiles);
    expect(parsed).toMatchObject({ command: 'publish', file: undefined });
  });

  it('treats "-" as an implicit publish from stdin', () => {
    const parsed = parseArgs(['-'], noFiles);
    expect(parsed).toMatchObject({ command: 'publish', file: '-' });
  });

  it('treats a leading flag as an implicit publish', () => {
    const parsed = parseArgs(['--as', 'daily-report', '-'], noFiles);
    expect(parsed).toMatchObject({ command: 'publish', as: 'daily-report', file: '-' });
  });

  it('treats an existing file path as an implicit publish', () => {
    const parsed = parseArgs(['/tmp/report.md'], fileAt('/tmp/report.md'));
    expect(parsed).toMatchObject({ command: 'publish', file: '/tmp/report.md' });
  });

  it('rejects a string that is neither a command, a flag, "-", nor an existing file', () => {
    expect(() => parseArgs(['frobnicate'], noFiles)).toThrow(UsageError);
  });

  it('parses the explicit publish command with flags', () => {
    const parsed = parseArgs(
      ['publish', '-', '--title', 'Piped in', '--style', 'book', '--expires', '7d', '--json'],
      noFiles,
    );
    expect(parsed).toEqual({
      command: 'publish',
      file: '-',
      title: 'Piped in',
      style: 'book',
      expires: '7d',
      breaks: false,
      as: undefined,
      json: true,
      url: undefined,
    });
  });

  it('parses update with PAGE and FILE positionals', () => {
    const parsed = parseArgs(['update', 'TOKEN1234', 'file.md', '--base-version', '2'], noFiles);
    expect(parsed).toMatchObject({ command: 'update', page: 'TOKEN1234', file: 'file.md', baseVersion: '2' });
  });

  it('requires a PAGE argument for update/get/versions/rm', () => {
    expect(() => parseArgs(['update'], noFiles)).toThrow(UsageError);
    expect(() => parseArgs(['get'], noFiles)).toThrow(UsageError);
    expect(() => parseArgs(['versions'], noFiles)).toThrow(UsageError);
    expect(() => parseArgs(['rm'], noFiles)).toThrow(UsageError);
  });

  it('parses get/list/versions/rm', () => {
    expect(parseArgs(['get', 'TOKEN1234', '--json'], noFiles)).toMatchObject({ command: 'get', page: 'TOKEN1234', json: true });
    expect(parseArgs(['list', '--limit', '10'], noFiles)).toMatchObject({ command: 'list', limit: '10', json: false });
    expect(parseArgs(['versions', 'TOKEN1234'], noFiles)).toMatchObject({ command: 'versions', page: 'TOKEN1234' });
    expect(parseArgs(['rm', 'TOKEN1234'], noFiles)).toMatchObject({ command: 'rm', page: 'TOKEN1234' });
  });

  it('parses config subcommands', () => {
    expect(parseArgs(['config', 'show'], noFiles)).toEqual({ command: 'config', action: 'show', value: undefined });
    expect(parseArgs(['config', 'set-key', 'mdl_x'], noFiles)).toEqual({ command: 'config', action: 'set-key', value: 'mdl_x' });
    expect(() => parseArgs(['config', 'bogus'], noFiles)).toThrow(UsageError);
  });
});
