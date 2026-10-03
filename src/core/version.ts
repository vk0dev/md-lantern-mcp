import { readFileSync } from 'node:fs';

interface PackageJson {
  version: string;
}

// Compiled to dist/core/version.js — two levels up from dist/core/ is the package root,
// where npm always places package.json alongside dist/.
const pkg = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as PackageJson;

export const VERSION: string = pkg.version;
