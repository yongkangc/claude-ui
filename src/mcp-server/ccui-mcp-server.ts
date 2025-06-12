import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { EventEmitter } from 'events';
import { PermissionRequest, MCPPermissionResponse, CCUIError } from '@/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * MCP server for handling permission requests from Claude
 */
export class CCUIMCPServer extends EventEmitter {
  private server: Server;
  private pendingRequests: Map<string, PermissionRequest> = new Map();
  private isStarted: boolean = false;

  constructor() {
    super();
    this.server = new Server(
      {
        name: "ccui-permissions",
        version: "1.0.0"
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    
    this.setupTools();
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      throw new CCUIError('MCP_ALREADY_STARTED', 'MCP server is already running', 400);
    }

    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      this.isStarted = true;
      this.emit('started');
    } catch (error) {
      throw new CCUIError('MCP_START_FAILED', `Failed to start MCP server: ${error}`, 500);
    }
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    try {
      await this.server.close();
      this.isStarted = false;
      this.emit('stopped');
    } catch (error) {
      throw new CCUIError('MCP_STOP_FAILED', `Failed to stop MCP server: ${error}`, 500);
    }
  }

  /**
   * Handle a permission decision from the user
   */
  handleDecision(requestId: string, action: 'approve' | 'deny', modifiedInput?: any): boolean {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      return false;
    }

    request.status = action === 'approve' ? 'approved' : 'denied';
    if (modifiedInput) {
      request.modifiedInput = modifiedInput;
    }
    if (action === 'deny') {
      request.denyReason = 'Permission denied by user';
    }

    this.emit('decision-made', { requestId, action, request });
    return true;
  }

  /**
   * Get all pending permission requests
   */
  getPendingRequests(): PermissionRequest[] {
    return Array.from(this.pendingRequests.values()).filter(r => r.status === 'pending');
  }

  /**
   * Get a specific permission request
   */
  getRequest(requestId: string): PermissionRequest | undefined {
    return this.pendingRequests.get(requestId);
  }

  private setupTools(): void {
    // Register the tools/list handler
    this.server.setRequestHandler(z.object({ method: z.literal('tools/list') }), async () => {
      return {
        tools: [
          {
            name: 'permission_prompt',
            description: 'Handle permission requests from Claude CLI',
            inputSchema: {
              type: 'object',
              properties: {
                tool_name: { type: 'string', description: 'The tool requesting permission' },
                input: { type: 'object', description: 'The input for the tool' },
                session_id: { type: 'string', description: 'The session ID for the conversation' }
              },
              required: ['tool_name', 'input', 'session_id']
            }
          }
        ]
      };
    });

    // Register the tools/call handler
    this.server.setRequestHandler(z.object({ method: z.literal('tools/call') }), async (request: any) => {
      const { name, arguments: args } = request.params;
      
      if (name !== 'permission_prompt') {
        throw new Error(`Unknown tool: ${name}`);
      }

      const { tool_name, input, session_id } = args;
      
      // Generate unique ID for this request
      const requestId = uuidv4();
      
      // Create permission request object
      const permissionRequest: PermissionRequest = {
        id: requestId,
        streamingId: session_id,
        toolName: tool_name,
        toolInput: input,
        timestamp: new Date().toISOString(),
        status: 'pending'
      };
      
      // Store request for later reference
      this.pendingRequests.set(requestId, permissionRequest);
      
      // Notify listeners about new permission request
      this.emit('permission-request', permissionRequest);
      
      // Wait for user decision
      const decision = await this.waitForDecision(requestId);
      
      // Return response to Claude
      return {
        content: [{
          type: "text",
          text: JSON.stringify(decision)
        }]
      };
    });
  }

  private async waitForDecision(requestId: string): Promise<MCPPermissionResponse> {
    return new Promise((resolve) => {
      const checkInterval = 100; // Check every 100ms
      const timeout = 300000; // 5 minute timeout
      let elapsed = 0;
      
      const checkDecision = setInterval(() => {
        const request = this.pendingRequests.get(requestId);
        
        if (!request || request.status === 'pending') {
          elapsed += checkInterval;
          
          if (elapsed >= timeout) {
            clearInterval(checkDecision);
            this.pendingRequests.delete(requestId);
            resolve({
              behavior: 'deny',
              message: 'Permission request timed out'
            });
          }
          return;
        }
        
        clearInterval(checkDecision);
        this.pendingRequests.delete(requestId);
        
        if (request.status === 'approved') {
          resolve({
            behavior: 'allow',
            updatedInput: request.modifiedInput || request.toolInput
          });
        } else {
          resolve({
            behavior: 'deny',
            message: request.denyReason || 'Permission denied by user'
          });
        }
      }, checkInterval);
    });
  }

  /**
   * Clear all pending requests
   */
  clearPendingRequests(): void {
    this.pendingRequests.clear();
  }

  /**
   * Get server status
   */
  getStatus(): { isStarted: boolean; pendingRequestCount: number } {
    return {
      isStarted: this.isStarted,
      pendingRequestCount: this.getPendingRequests().length
    };
  }
}