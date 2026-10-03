import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerTools } from './tools/hello.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'md-lantern-mcp',
    version: '0.1.0',
  });
  registerTools(server);
  return server;
}

// Smithery requires this export for server scanning
export const createSandboxServer = createServer;
