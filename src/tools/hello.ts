import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerTools(server: McpServer): void {
  server.registerTool(
    'hello_world',
    {
      description:
        'Returns a greeting message. This is a placeholder tool — replace it with your actual MCP tool implementation that solves a real problem for the user.',
      inputSchema: {
        name: z.string().optional().describe('Name to greet. Defaults to "world".'),
      },
    },
    async (input) => ({
      content: [
        {
          type: 'text' as const,
          text: `Hello, ${input.name ?? 'world'}! This MCP server is working.`,
        },
      ],
    }),
  );
}
