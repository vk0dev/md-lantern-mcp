/**
 * MCP client smoke test — verifies the server starts, lists tools, and responds.
 * Run after `npm run build`: node scripts/dogfood_smoke.mjs
 */
import process from 'node:process';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const cwd = process.cwd();

const transport = new StdioClientTransport({
  command: 'node',
  args: ['dist/server.js'],
  cwd,
  stderr: 'inherit',
});

const client = new Client({
  name: 'smoke-test',
  version: '0.1.0',
});

async function run() {
  await client.connect(transport);

  const tools = await client.listTools();
  const toolNames = tools.tools.map((tool) => tool.name).sort();
  console.log('Tools discovered:', toolNames);

  if (toolNames.length === 0) {
    throw new Error('No tools discovered — server may not be registering tools correctly');
  }

  // Call the first tool as a basic smoke test
  const result = await client.callTool({
    name: toolNames[0],
    arguments: {},
  });

  console.log('First tool result:', JSON.stringify(result?.structuredContent ?? result?.content, null, 2));
  console.log('Smoke test passed!');

  await client.close();
}

run().catch(async (error) => {
  console.error('Smoke test failed:', error instanceof Error ? error.stack ?? error.message : String(error));
  try {
    await client.close();
  } catch {}
  process.exit(1);
});
