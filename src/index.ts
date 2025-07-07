#!/usr/bin/env bun
/* global process console */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { initializeWorkspace } from './initializeWorkspace.js';

async function main() {
  const args = process.argv.slice(2);
  const workingDir = args[0];

  if (!workingDir) {
    console.error('Error: Working directory parameter is required');
    console.error('Usage: mcp-tasks <working-directory>');
    process.exit(1);
  }

  // Initialize the workspace
  await initializeWorkspace(workingDir);

  const server = new McpServer({
    name: 'mcp-tasks',
    version: '1.0.0',
  });

  // Register get_current_tasks tool
  server.registerTool(
    'get_current_tasks',
    {
      title: 'Get Current Tasks',
      description: 'Retrieve the entire current.md file contents',
      inputSchema: {},
    },
    () => {
      try {
        const filePath = join(workingDir, 'current.md');
        const content = readFileSync(filePath, 'utf-8');

        return {
          content: [{
            type: 'text',
            text: content,
          }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        return {
          content: [{
            type: 'text',
            text: `Error reading current.md: ${errorMessage}`,
          }],
          isError: true,
        };
      }
    },
  );

  // Register get_task_backlog tool
  server.registerTool(
    'get_task_backlog',
    {
      title: 'Get Task Backlog',
      description: 'Retrieve the entire backlog.md file contents',
      inputSchema: {},
    },
    () => {
      try {
        const filePath = join(workingDir, 'backlog.md');
        const content = readFileSync(filePath, 'utf-8');

        return {
          content: [{
            type: 'text',
            text: content,
          }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        return {
          content: [{
            type: 'text',
            text: `Error reading backlog.md: ${errorMessage}`,
          }],
          isError: true,
        };
      }
    },
  );

  const transport = new StdioServerTransport();

  await server.connect(transport);
}

main().catch(console.error);
