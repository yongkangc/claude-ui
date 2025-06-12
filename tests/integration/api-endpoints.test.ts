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

  beforeEach(async () => {
    // Create temporary directories for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ccui-api-test-'));
    tempClaudeHome = path.join(tempDir, '.claude');
    await fs.mkdir(tempClaudeHome, { recursive: true });
    await fs.mkdir(path.join(tempClaudeHome, 'projects'), { recursive: true });
    
    // Create minimal MCP config
    mcpConfigPath = path.join(tempDir, 'mcp-config.json');
    const mcpConfig = {
      mcpServers: {}
    };
    await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
    
    // Create server with real services but configured for testing
    server = new CCUIServer({
      port: 0, // Use any available port
      mcpConfigPath,
      claudeHomePath: tempClaudeHome
    });
    
    // Start server and get the actual port
    httpServer = (server as any).app.listen(0);
    const address = httpServer.address() as AddressInfo;
    baseUrl = `http://localhost:${address.port}`;
  });

  afterEach(async () => {
    // Stop server
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }
    
    // Stop any active conversations
    const processManager = (server as any).processManager;
    const activeSessions = processManager.getActiveSessions();
    for (const sessionId of activeSessions) {
      await processManager.stopConversation(sessionId);
    }
    
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
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
      it('should start a new conversation', async () => {
        const requestBody = {
          workingDirectory: process.cwd(), // Use current directory for testing
          initialPrompt: 'Hello Claude, please respond with just "Hello" and nothing else.'
        };

        const response = await request(baseUrl)
          .post('/api/conversations/start')
          .send(requestBody)
          .expect(200);

        expect(response.body).toHaveProperty('sessionId');
        expect(response.body.sessionId).toMatch(/^[a-f0-9-]{36}$/); // UUID format
        expect(response.body).toHaveProperty('streamUrl');
        expect(response.body.streamUrl).toBe(`/api/stream/${response.body.sessionId}`);
      }, 30000);

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
      it('should list conversations when no history exists', async () => {
        const response = await request(baseUrl)
          .get('/api/conversations')
          .expect(200);

        expect(response.body).toHaveProperty('conversations');
        expect(response.body).toHaveProperty('total');
        expect(Array.isArray(response.body.conversations)).toBe(true);
        expect(typeof response.body.total).toBe('number');
      });
      
      it('should list conversations with real history', async () => {
        // Create a sample conversation file
        const projectDir = path.join(tempClaudeHome, 'projects', '-Users-test-project');
        await fs.mkdir(projectDir, { recursive: true });
        
        const sessionId = 'test-session-history';
        const conversationContent = `{"type":"summary","summary":"Test Conversation","leafUuid":"test-uuid"}
{"type":"user","message":{"role":"user","content":"Hello"},"uuid":"msg1","timestamp":"2024-01-01T00:00:00Z","sessionId":"${sessionId}"}
{"type":"assistant","message":{"role":"assistant","content":"Hi there"},"uuid":"msg2","timestamp":"2024-01-01T00:00:01Z","sessionId":"${sessionId}"}`;
        
        await fs.writeFile(path.join(projectDir, `${sessionId}.jsonl`), conversationContent);
        
        const response = await request(baseUrl)
          .get('/api/conversations')
          .expect(200);

        expect(response.body.conversations).toHaveLength(1);
        expect(response.body.conversations[0].sessionId).toBe(sessionId);
        expect(response.body.conversations[0].summary).toBe('Test Conversation');
        expect(response.body.total).toBe(1);
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
      it('should get conversation details', async () => {
        // Create a sample conversation file
        const projectDir = path.join(tempClaudeHome, 'projects', '-Users-test-project-detail');
        await fs.mkdir(projectDir, { recursive: true });
        
        const sessionId = 'test-session-detail';
        const conversationContent = `{"type":"summary","summary":"Test Conversation Detail","leafUuid":"test-uuid"}
{"parentUuid":null,"type":"user","message":{"role":"user","content":"Hello"},"uuid":"msg1","timestamp":"2024-01-01T00:00:00Z","sessionId":"${sessionId}","cwd":"/Users/test/project/detail"}
{"parentUuid":"msg1","type":"assistant","message":{"role":"assistant","content":"Hi there","id":"msg_123"},"uuid":"msg2","timestamp":"2024-01-01T00:00:01Z","sessionId":"${sessionId}","costUSD":0.01,"durationMs":1000}`;
        
        await fs.writeFile(path.join(projectDir, `${sessionId}.jsonl`), conversationContent);
        
        const response = await request(baseUrl)
          .get(`/api/conversations/${sessionId}`)
          .expect(200);

        expect(response.body).toHaveProperty('messages');
        expect(response.body.messages).toHaveLength(2);
        expect(response.body).toHaveProperty('summary', 'Test Conversation Detail');
        expect(response.body).toHaveProperty('projectPath', '/Users/test/project/detail');
        expect(response.body).toHaveProperty('metadata');
      });

      it('should handle conversation not found', async () => {
        await request(baseUrl)
          .get('/api/conversations/non-existent')
          .expect(404);
      });
    });

    describe('POST /api/conversations/:sessionId/continue', () => {
      it('should continue conversation', async () => {
        // First start a conversation
        const startResponse = await request(baseUrl)
          .post('/api/conversations/start')
          .send({
            workingDirectory: process.cwd(),
            initialPrompt: 'Hello Claude'
          })
          .expect(200);
        
        const sessionId = startResponse.body.sessionId;
        
        // Wait a moment for the conversation to be established
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const response = await request(baseUrl)
          .post(`/api/conversations/${sessionId}/continue`)
          .send({ prompt: 'Please respond with just "continued" and nothing else.' })
          .expect(200);

        expect(response.body).toEqual({
          streamUrl: `/api/stream/${sessionId}`
        });
      }, 30000);

      it('should handle session not found', async () => {
        await request(baseUrl)
          .post('/api/conversations/non-existent/continue')
          .send({ prompt: 'Test' })
          .expect(500);
      });
    });

    describe('POST /api/conversations/:sessionId/stop', () => {
      it('should stop conversation', async () => {
        // First start a conversation
        const startResponse = await request(baseUrl)
          .post('/api/conversations/start')
          .send({
            workingDirectory: process.cwd(),
            initialPrompt: 'Hello Claude'
          })
          .expect(200);
        
        const sessionId = startResponse.body.sessionId;
        
        const response = await request(baseUrl)
          .post(`/api/conversations/${sessionId}/stop`)
          .expect(200);

        expect(response.body).toEqual({ success: true });
      }, 30000);

      it('should handle stop failure', async () => {
        const response = await request(baseUrl)
          .post('/api/conversations/non-existent/stop')
          .expect(200);

        expect(response.body).toEqual({ success: false });
      });
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