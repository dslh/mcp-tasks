#!/usr/bin/env bun
/* global process console */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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

  const server = new Server(
    {
      name: 'mcp-tasks',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // TODO: Implement MCP tools here

  const transport = new StdioServerTransport();

  await server.connect(transport);
}

main().catch(console.error);
