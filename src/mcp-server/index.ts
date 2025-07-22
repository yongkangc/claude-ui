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

  const { tool_name, input } = request.params.arguments as { tool_name: string; input: Record<string, any> };

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

    // Get the permission request ID from the notification response
    const notificationData = await response.json() as { success: boolean; id: string };
    const permissionRequestId = notificationData.id;

    logger.debug('Permission request created', { permissionRequestId, streamingId: CCUI_STREAMING_ID });

    // Poll for permission decision
    const POLL_INTERVAL = 1000; // 1 second
    const TIMEOUT = 10 * 60 * 1000; // 10 minutes
    const startTime = Date.now();

    while (true) {
      // Check timeout
      if (Date.now() - startTime > TIMEOUT) {
        logger.warn('Permission request timed out', { tool_name, permissionRequestId });
        const timeoutResponse = {
          behavior: 'deny',
          message: 'Permission request timed out after 10 minutes',
        };
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(timeoutResponse),
          }],
        };
      }

      // Poll for permission status
      const pollResponse = await fetch(
        `${CCUI_SERVER_URL}/api/permissions?streamingId=${CCUI_STREAMING_ID}&status=pending`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!pollResponse.ok) {
        logger.error('Failed to poll permission status', { status: pollResponse.status });
        throw new Error(`Failed to poll permission status: ${pollResponse.status}`);
      }

      const { permissions } = await pollResponse.json() as { permissions: Array<any> };
      const permission = permissions.find((p: any) => p.id === permissionRequestId);

      if (!permission) {
        // Permission has been processed (no longer pending)
        // Fetch all permissions to find our specific one
        const allPermissionsResponse = await fetch(
          `${CCUI_SERVER_URL}/api/permissions?streamingId=${CCUI_STREAMING_ID}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!allPermissionsResponse.ok) {
          logger.error('Failed to fetch all permissions', { status: allPermissionsResponse.status });
          throw new Error(`Failed to fetch all permissions: ${allPermissionsResponse.status}`);
        }

        const { permissions: allPermissions } = await allPermissionsResponse.json() as { permissions: Array<any> };
        const processedPermission = allPermissions.find((p: any) => p.id === permissionRequestId);

        if (processedPermission) {
          if (processedPermission.status === 'approved') {
            logger.debug('Permission approved', { tool_name, permissionRequestId });
            const approvalResponse = {
              behavior: 'allow',
              updatedInput: processedPermission.modifiedInput || input,
            };
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(approvalResponse),
              }],
            };
          } else if (processedPermission.status === 'denied') {
            logger.debug('Permission denied', { tool_name, permissionRequestId });
            const denyResponse = {
              behavior: 'deny',
              message: processedPermission.denyReason || 'Permission denied by user',
            };
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(denyResponse),
              }],
            };
          }
        }
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
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