#!/usr/bin/env bun
/* global process console */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { setWorkingDirectory } from './config.js';
import { initializeWorkspace } from './initializeWorkspace.js';
import * as getCurrentTasks from './tools/getCurrentTasks.js';
import * as getTaskBacklog from './tools/getTaskBacklog.js';
import * as addTask from './tools/addTask.js';
import * as finishTask from './tools/finishTask.js';

async function main() {
  const args = process.argv.slice(2);
  const workingDir = args[0];

  if (!workingDir) {
    console.error('Error: Working directory parameter is required');
    console.error('Usage: mcp-tasks <working-directory>');
    process.exit(1);
  }

  // Set working directory for tools to use
  setWorkingDirectory(workingDir);

  // Initialize the workspace
  await initializeWorkspace(workingDir);

  const server = new McpServer({
    name: 'mcp-tasks',
    title: 'Weekly Task Tracker',
    version: '1.0.0',
  });

  // Register tools
  server.registerTool(getCurrentTasks.name, getCurrentTasks.config, getCurrentTasks.handler);
  server.registerTool(getTaskBacklog.name, getTaskBacklog.config, getTaskBacklog.handler);
  server.registerTool(addTask.name, addTask.config, addTask.handler);
  server.registerTool(finishTask.name, finishTask.config, finishTask.handler);

  const transport = new StdioServerTransport();

  await server.connect(transport);
}

main().catch(console.error);
