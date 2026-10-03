import { describe, it, expect } from 'vitest';

import { createServer } from '../src/createServer.js';

describe('hello_world tool', () => {
  it('creates a server with registered tools', () => {
    const server = createServer();
    expect(server).toBeDefined();
  });
});
