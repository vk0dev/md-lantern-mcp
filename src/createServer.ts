import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerTools } from './tools/index.js';

const INSTRUCTIONS =
  'Use publish_markdown instead of pasting a long report, table, log, or code-heavy answer directly into ' +
  'chat: it returns a shareable URL that unfurls as a card in Telegram/Slack and keeps a raw .md twin for the ' +
  'next agent to read back verbatim. Pass the same "name" on a later publish_markdown call to update a ' +
  'recurring report (e.g. a daily status page) in place instead of creating a new link every time. Use a ' +
  'collection (create_collection, then "collection" on publish_markdown) instead of a name when the pages ' +
  'should stay separate but browsable together, such as a recurring report stream or a multi-part document.';

export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: 'md-lantern-mcp',
      version: '1.1.0',
    },
    {
      instructions: INSTRUCTIONS,
    },
  );
  registerTools(server);
  return server;
}

// Smithery requires this export for server scanning
export const createSandboxServer = createServer;
