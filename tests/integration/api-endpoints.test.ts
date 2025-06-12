import request from 'supertest';
import { CCUIServer } from '@/ccui-server';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Server } from 'http';
import { AddressInfo } from 'net';

describe('API Endpoints Integration', () => {
  let server: CCUIServer;
  let httpServer: Server;
  let baseUrl: string;
  let tempDir: string;
  let tempClaudeHome: string;
  let mcpConfigPath: string;

  // Helper function to create sample conversation history
  const createSampleConversations = async () => {
    // Create multiple project directories with sample conversations
    const projects = [
      {
        name: '-Users-test-project-web',
        conversations: [
          {
            sessionId: 'web-session-1',
            summary: 'Build a React component',
            cwd: '/Users/test/project/web',
            messages: [
              {
                type: 'user',
                content: 'Create a button component with TypeScript',
                timestamp: '2024-01-01T10:00:00Z'
              },
              {
                type: 'assistant',
                content: 'I\'ll help you create a TypeScript React button component.',
                timestamp: '2024-01-01T10:00:05Z',
                costUSD: 0.02,
                durationMs: 2500
              }
            ]
          },
          {
            sessionId: 'web-session-2', 
            summary: 'Debug CSS styling issues',
            cwd: '/Users/test/project/web',
            messages: [
              {
                type: 'user',
                content: 'Help me fix the layout issues in my CSS',
                timestamp: '2024-01-02T14:30:00Z'
              },
              {
                type: 'assistant',
                content: 'Let me analyze your CSS layout issues.',
                timestamp: '2024-01-02T14:30:03Z',
                costUSD: 0.015,
                durationMs: 1800
              }
            ]
          }
        ]
      },
      {
        name: '-home-user-backend',
        conversations: [
          {
            sessionId: 'backend-session-1',
            summary: 'Node.js API development',
            cwd: '/home/user/backend',
            messages: [
              {
                type: 'user',
                content: 'Create an Express.js REST API',
                timestamp: '2024-01-03T09:15:00Z'
              },
              {
                type: 'assistant',
                content: 'I\'ll help you create an Express.js REST API with proper structure.',
                timestamp: '2024-01-03T09:15:08Z',
                costUSD: 0.03,
                durationMs: 3200
              }
            ]
          }
        ]
      }
    ];

    for (const project of projects) {
      const projectDir = path.join(tempClaudeHome, 'projects', project.name);
      await fs.mkdir(projectDir, { recursive: true });
      
      for (const conversation of project.conversations) {
        const conversationLines = [];
        
        // Add summary line
        conversationLines.push(JSON.stringify({
          type: 'summary',
          summary: conversation.summary,
          leafUuid: `leaf-${conversation.sessionId}`
        }));
        
        // Add message lines
        conversation.messages.forEach((msg, index) => {
          const messageData: any = {
            parentUuid: index === 0 ? null : `msg-${index}`,
            type: msg.type,
            message: {
              role: msg.type,
              content: msg.content,
              ...(msg.type === 'assistant' && { id: `msg_${index + 1}` })
            },
            uuid: `msg-${index + 1}`,
            timestamp: msg.timestamp,
            sessionId: conversation.sessionId,
            cwd: conversation.cwd
          };
          
          if (msg.type === 'assistant' && msg.costUSD) {
            messageData.costUSD = msg.costUSD;
            messageData.durationMs = msg.durationMs;
          }
          
          conversationLines.push(JSON.stringify(messageData));
        });
        
        const conversationContent = conversationLines.join('\n');
        await fs.writeFile(path.join(projectDir, `${conversation.sessionId}.jsonl`), conversationContent);
      }
    }
  };

  beforeEach(async () => {
    // Create temporary directories for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ccui-api-test-'));
    tempClaudeHome = path.join(tempDir, '.claude');
    await fs.mkdir(tempClaudeHome, { recursive: true });
    await fs.mkdir(path.join(tempClaudeHome, 'projects'), { recursive: true });
    
    // Create minimal Claude settings.json for isolated testing
    const claudeSettings = {
      "environment_variables": {},
      "tool_permissions": {},
      "default_settings": {
        "model": "claude-sonnet-4-20250514"
      }
    };
    await fs.writeFile(path.join(tempClaudeHome, 'settings.json'), JSON.stringify(claudeSettings, null, 2));
    
    // Create minimal MCP config
    mcpConfigPath = path.join(tempDir, 'mcp-config.json');
    const mcpConfig = {
      mcpServers: {}
    };
    await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
    
    // Create sample conversation history for testing
    await createSampleConversations();
    
    // Create server with real services but configured for isolated testing
    server = new CCUIServer({
      port: 0, // Use any available port
      mcpConfigPath,
      claudeHomePath: tempClaudeHome,
      testMode: true // Enable test mode for HOME environment override
    });
    
    // Start server and get the actual port
    httpServer = (server as any).app.listen(0);
    const address = httpServer.address() as AddressInfo;
    baseUrl = `http://localhost:${address.port}`;
  });

  afterEach(async () => {
    try {
      // Stop any active conversations first to ensure clean shutdown
      if (server) {
        const processManager = (server as any).processManager;
        const activeSessions = processManager.getActiveSessions();
        
        if (activeSessions.length > 0) {
          console.log(`Cleaning up ${activeSessions.length} active sessions...`);
          
          // Stop all sessions in parallel with timeout
          await Promise.allSettled(
            activeSessions.map(async (sessionId) => {
              try {
                const stopped = await Promise.race([
                  processManager.stopConversation(sessionId),
                  new Promise(resolve => setTimeout(() => resolve(false), 10000)) // 10s timeout
                ]);
                if (!stopped) {
                  console.warn(`Failed to stop session ${sessionId} within timeout`);
                }
              } catch (error) {
                console.warn(`Error stopping session ${sessionId}:`, error);
              }
            })
          );
          
          // Wait a moment for processes to fully terminate
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      // Stop HTTP server
      if (httpServer) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Server close timeout'));
          }, 5000);
          
          httpServer.close((error) => {
            clearTimeout(timeout);
            if (error) {
              console.warn('Error closing HTTP server:', error);
            }
            resolve();
          });
        });
      }
    } catch (error) {
      console.warn('Error during cleanup:', error);
    } finally {
      // Always clean up temp directory, even if other cleanup fails
      try {
        if (tempDir) {
          await fs.rm(tempDir, { recursive: true, force: true });
        }
      } catch (error) {
        console.warn('Error cleaning up temp directory:', error);
      }
    }
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(baseUrl)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('Conversation Management', () => {
    describe('POST /api/conversations/start', () => {
      it('should start a new conversation with real Claude CLI', async () => {
        const requestBody = {
          workingDirectory: tempDir, // Use isolated test directory
          initialPrompt: 'Hello Claude, please respond with just "Hello" and nothing else. Keep it very short.',
          model: 'claude-sonnet-4-20250514'
        };

        const response = await request(baseUrl)
          .post('/api/conversations/start')
          .send(requestBody)
          .expect(200);

        expect(response.body).toHaveProperty('sessionId');
        expect(response.body.sessionId).toMatch(/^[a-f0-9-]{36}$/); // UUID format
        expect(response.body).toHaveProperty('streamUrl');
        expect(response.body.streamUrl).toBe(`/api/stream/${response.body.sessionId}`);
        
        // Wait a moment to let the process start
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify the session is active
        const processManager = (server as any).processManager;
        expect(processManager.isSessionActive(response.body.sessionId)).toBe(true);
      }, 60000);

      it('should handle start conversation errors', async () => {
        const requestBody = {
          workingDirectory: '/nonexistent/directory/that/does/not/exist',
          initialPrompt: 'Hello Claude'
        };

        await request(baseUrl)
          .post('/api/conversations/start')
          .send(requestBody)
          .expect(500);
      });

      it('should validate required fields', async () => {
        await request(baseUrl)
          .post('/api/conversations/start')
          .send({})
          .expect(500); // Should fail due to missing required fields
      });
    });

    describe('GET /api/conversations', () => {
      it('should list conversations with sample history', async () => {
        const response = await request(baseUrl)
          .get('/api/conversations')
          .expect(200);

        expect(response.body).toHaveProperty('conversations');
        expect(response.body).toHaveProperty('total');
        expect(Array.isArray(response.body.conversations)).toBe(true);
        expect(response.body.total).toBeGreaterThan(0);
        expect(response.body.conversations.length).toBeGreaterThan(0);
        
        // Verify sample conversations are present
        const summaries = response.body.conversations.map(c => c.summary);
        expect(summaries).toContain('Build a React component');
        expect(summaries).toContain('Debug CSS styling issues');
        expect(summaries).toContain('Node.js API development');
      });
      
      it('should filter conversations by project path', async () => {
        const response = await request(baseUrl)
          .get('/api/conversations')
          .query({
            projectPath: '/Users/test/project/web'
          })
          .expect(200);

        expect(response.body).toHaveProperty('conversations');
        expect(response.body).toHaveProperty('total');
        
        // Should only return conversations from the web project
        if (response.body.conversations.length > 0) {
          const summaries = response.body.conversations.map(c => c.summary);
          expect(summaries).toEqual(expect.arrayContaining(['Build a React component', 'Debug CSS styling issues']));
          expect(summaries).not.toContain('Node.js API development');
        }
      });

      it('should handle query parameters', async () => {
        const response = await request(baseUrl)
          .get('/api/conversations')
          .query({
            projectPath: '/test/project',
            limit: '10',
            offset: '0',
            sortBy: 'created',
            order: 'desc'
          })
          .expect(200);

        expect(response.body).toHaveProperty('conversations');
        expect(response.body).toHaveProperty('total');
      });
    });

    describe('GET /api/conversations/:sessionId', () => {
      it('should get conversation details from sample data', async () => {
        // Use one of our sample conversations
        const sessionId = 'web-session-1';
        
        const response = await request(baseUrl)
          .get(`/api/conversations/${sessionId}`)
          .expect(200);

        expect(response.body).toHaveProperty('messages');
        expect(response.body.messages).toHaveLength(2);
        expect(response.body).toHaveProperty('summary', 'Build a React component');
        expect(response.body).toHaveProperty('projectPath', '/Users/test/project/web');
        expect(response.body).toHaveProperty('metadata');
        
        // Verify message content
        expect(response.body.messages[0].message.content).toBe('Create a button component with TypeScript');
        expect(response.body.messages[1].message.content).toBe('I\'ll help you create a TypeScript React button component.');
        expect(response.body.messages[1]).toHaveProperty('costUSD', 0.02);
        expect(response.body.messages[1]).toHaveProperty('durationMs', 2500);
      });

      it('should handle conversation not found', async () => {
        await request(baseUrl)
          .get('/api/conversations/non-existent')
          .expect(404);
      });
    });

    describe('POST /api/conversations/:sessionId/continue', () => {
      it('should continue conversation with real Claude CLI', async () => {
        // First start a conversation with isolated environment
        const startResponse = await request(baseUrl)
          .post('/api/conversations/start')
          .send({
            workingDirectory: tempDir,
            initialPrompt: 'Hello Claude, just say "Hi" and nothing else.',
            model: 'claude-sonnet-4-20250514'
          })
          .expect(200);
        
        const sessionId = startResponse.body.sessionId;
        
        // Wait longer for the conversation to be established
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Verify session is active before continuing
        const processManager = (server as any).processManager;
        expect(processManager.isSessionActive(sessionId)).toBe(true);
        
        const response = await request(baseUrl)
          .post(`/api/conversations/${sessionId}/continue`)
          .send({ prompt: 'Please respond with just "continued" and nothing else.' })
          .expect(200);

        expect(response.body).toEqual({
          streamUrl: `/api/stream/${sessionId}`
        });
      }, 60000);

      it('should handle session not found', async () => {
        await request(baseUrl)
          .post('/api/conversations/non-existent/continue')
          .send({ prompt: 'Test' })
          .expect(500);
      });
    });

    describe('POST /api/conversations/:sessionId/stop', () => {
      it('should stop conversation with real Claude CLI', async () => {
        // First start a conversation with isolated environment
        const startResponse = await request(baseUrl)
          .post('/api/conversations/start')
          .send({
            workingDirectory: tempDir,
            initialPrompt: 'Hello Claude, just say "Hi" and nothing else.',
            model: 'claude-sonnet-4-20250514'
          })
          .expect(200);
        
        const sessionId = startResponse.body.sessionId;
        
        // Wait a moment for the process to start
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verify session is active before stopping
        const processManager = (server as any).processManager;
        expect(processManager.isSessionActive(sessionId)).toBe(true);
        
        const response = await request(baseUrl)
          .post(`/api/conversations/${sessionId}/stop`)
          .expect(200);

        expect(response.body).toEqual({ success: true });
        
        // Verify session is no longer active
        await new Promise(resolve => setTimeout(resolve, 1000));
        expect(processManager.isSessionActive(sessionId)).toBe(false);
      }, 60000);

      it('should handle stop failure', async () => {
        const response = await request(baseUrl)
          .post('/api/conversations/non-existent/stop')
          .expect(200);

        expect(response.body).toEqual({ success: false });
      });
    });
  });

  describe('Streaming Integration', () => {
    it('should stream conversation updates with real Claude CLI', async () => {
      // Start a conversation with isolated environment
      const startResponse = await request(baseUrl)
        .post('/api/conversations/start')
        .send({
          workingDirectory: tempDir,
          initialPrompt: 'Hello Claude, please respond with exactly "Hi there!" and nothing else.',
          model: 'claude-sonnet-4-20250514'
        })
        .expect(200);

      const sessionId = startResponse.body.sessionId;
      const streamUrl = startResponse.body.streamUrl;

      // Connect to stream endpoint
      const streamResponse = await request(baseUrl)
        .get(streamUrl)
        .expect(200);

      expect(streamResponse.headers['content-type']).toContain('application/x-ndjson');
      expect(streamResponse.headers['cache-control']).toBe('no-cache');
      expect(streamResponse.headers['connection']).toBe('keep-alive');
      
      // Note: In a real implementation, you'd need to parse the streaming response
      // For now, we just verify the stream endpoint is accessible
    }, 60000);

    it('should handle multiple clients on same stream', async () => {
      // Start a conversation
      const startResponse = await request(baseUrl)
        .post('/api/conversations/start')
        .send({
          workingDirectory: tempDir,
          initialPrompt: 'Hello Claude, just say "Hi" and nothing else.',
          model: 'claude-sonnet-4-20250514'
        })
        .expect(200);

      const sessionId = startResponse.body.sessionId;
      const streamUrl = startResponse.body.streamUrl;

      // Multiple clients should be able to connect to the same stream
      const client1Promise = request(baseUrl).get(streamUrl).expect(200);
      const client2Promise = request(baseUrl).get(streamUrl).expect(200);

      const [client1Response, client2Response] = await Promise.all([
        client1Promise,
        client2Promise
      ]);

      expect(client1Response.headers['content-type']).toContain('application/x-ndjson');
      expect(client2Response.headers['content-type']).toContain('application/x-ndjson');
    }, 60000);

    it('should handle stream for non-existent session', async () => {
      await request(baseUrl)
        .get('/api/stream/non-existent-session')
        .expect(404);
    });
  });

  describe('Permission Management', () => {
    describe('GET /api/permissions', () => {
      it('should list all pending permissions', async () => {
        const response = await request(baseUrl)
          .get('/api/permissions')
          .expect(200);

        expect(response.body).toHaveProperty('permissions');
        expect(Array.isArray(response.body.permissions)).toBe(true);
      });

      it('should filter permissions by session ID', async () => {
        const response = await request(baseUrl)
          .get('/api/permissions')
          .query({ sessionId: 'session-1' })
          .expect(200);

        expect(response.body).toHaveProperty('permissions');
        expect(Array.isArray(response.body.permissions)).toBe(true);
      });
    });

    describe('POST /api/permissions/:requestId', () => {
      it('should handle permission decision for non-existent request', async () => {
        const requestId = 'perm-123';

        const response = await request(baseUrl)
          .post(`/api/permissions/${requestId}`)
          .send({ action: 'approve' })
          .expect(200);

        expect(response.body).toEqual({ success: false });
      });

      it('should handle deny permission request', async () => {
        const requestId = 'perm-123';

        const response = await request(baseUrl)
          .post(`/api/permissions/${requestId}`)
          .send({ action: 'deny' })
          .expect(200);

        expect(response.body).toHaveProperty('success');
      });

      it('should handle modified input', async () => {
        const requestId = 'perm-123';
        const modifiedInput = { command: 'ls -la' };

        const response = await request(baseUrl)
          .post(`/api/permissions/${requestId}`)
          .send({ 
            action: 'approve',
            modifiedInput
          })
          .expect(200);

        expect(response.body).toHaveProperty('success');
      });

      it('should handle request not found', async () => {
        const requestId = 'non-existent';

        const response = await request(baseUrl)
          .post(`/api/permissions/${requestId}`)
          .send({ action: 'approve' })
          .expect(200);

        expect(response.body).toEqual({ success: false });
      });
    });
  });

  describe('System Management', () => {
    describe('GET /api/system/status', () => {
      it('should return system status', async () => {
        const response = await request(baseUrl)
          .get('/api/system/status')
          .expect(200);

        expect(response.body).toHaveProperty('claudeVersion');
        expect(response.body).toHaveProperty('claudePath');
        expect(response.body).toHaveProperty('configPath');
        expect(response.body).toHaveProperty('activeConversations');
        expect(typeof response.body.activeConversations).toBe('number');
      });
    });

    describe('GET /api/models', () => {
      it('should return available models', async () => {
        const response = await request(baseUrl)
          .get('/api/models')
          .expect(200);

        expect(response.body).toHaveProperty('models');
        expect(response.body).toHaveProperty('defaultModel');
        expect(Array.isArray(response.body.models)).toBe(true);
        expect(typeof response.body.defaultModel).toBe('string');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown routes', async () => {
      await request(baseUrl)
        .get('/api/unknown')
        .expect(404);
    });

    it('should handle malformed JSON requests', async () => {
      await request(baseUrl)
        .post('/api/conversations/start')
        .set('Content-Type', 'application/json')
        .send('{"malformed": json}')
        .expect(400);
    });

    it('should handle service errors gracefully', async () => {
      await request(baseUrl)
        .post('/api/conversations/start')
        .send({
          workingDirectory: '/nonexistent/path',
          initialPrompt: 'test'
        })
        .expect(500);
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const response = await request(baseUrl)
        .get('/health')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should handle preflight requests', async () => {
      await request(baseUrl)
        .options('/api/conversations/start')
        .expect(204);
    });
  });
});