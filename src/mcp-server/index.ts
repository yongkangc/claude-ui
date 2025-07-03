#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
import { logger } from '@/services/logger';

// Get CCUI server URL from environment
const CCUI_SERVER_URL = process.env.CCUI_SERVER_URL || `http://localhost:${process.env.CCUI_SERVER_PORT || '3001'}`;

// Get CCUI streaming ID from environment (passed by ClaudeProcessManager)
const CCUI_STREAMING_ID = process.env.CCUI_STREAMING_ID;

// Create MCP server
const server = new Server({
  name: 'ccui-permissions',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

// Define the approval_prompt tool
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'approval_prompt',
    description: 'Request approval for tool usage from CCUI',
    inputSchema: {
      type: 'object',
      properties: {
        tool_name: {
          type: 'string',
          description: 'The tool requesting permission',
        },
        input: {
          type: 'object',
          description: 'The input for the tool',
        },
      },
      required: ['tool_name', 'input'],
    },
  }],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'approval_prompt') {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
  }

  const { tool_name, input } = request.params.arguments as { tool_name: string; input: any };

  try {
    // Log the permission request
    logger.debug('MCP Permission request received', { tool_name, input, streamingId: CCUI_STREAMING_ID });

    // Send the permission request to CCUI server
    const response = await fetch(`${CCUI_SERVER_URL}/api/permissions/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        toolName: tool_name,
        toolInput: input,
        streamingId: CCUI_STREAMING_ID || 'unknown', // Include the streaming ID from environment
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to notify CCUI server', { status: response.status, error: errorText });
      throw new Error(`Failed to notify CCUI server: ${errorText}`);
    }

    // For now, always approve with the original input
    const approvalResponse = {
      behavior: 'allow',
      updatedInput: input,
    };

    logger.debug('MCP Permission approved automatically', { tool_name });

    // Return the JSON-stringified response as required by Claude
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(approvalResponse),
      }],
    };
  } catch (error) {
    logger.error('Error processing permission request', { error });
    
    // Return a deny response on error
    const denyResponse = {
      behavior: 'deny',
      message: `Permission denied due to error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(denyResponse),
      }],
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('MCP Permission server started', { ccuiServerUrl: CCUI_SERVER_URL });
}

main().catch((error) => {
  logger.error('MCP server error', { error });
  process.exit(1);
});