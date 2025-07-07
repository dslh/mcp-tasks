#!/usr/bin/env bun

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initializeWorkspace } from "./initializeWorkspace.js";

async function main() {
  const args = process.argv.slice(2);
  const workingDir = args[0] || process.cwd();

  // Initialize the workspace
  await initializeWorkspace(workingDir);

  const server = new Server(
    {
      name: "mcp-tasks",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // TODO: Implement MCP tools here

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);