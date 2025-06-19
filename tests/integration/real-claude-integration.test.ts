import { CCUIServer } from '@/ccui-server';
import { ClaudeProcessManager } from '@/services/claude-process-manager';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EventSource } from 'eventsource';

/**
 * Integration test for real Claude CLI with fake home directory
 */
describe('Real Claude CLI Integration', () => {
  let server: CCUIServer;
  let tempHomeDir: string;
  let serverPort: number;
  let baseUrl: string;

  beforeAll(async () => {
    // Create temporary fake home directory
    tempHomeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ccui-test-home-'));
    
    // Use a random port to avoid conflicts with streaming-integration.test.ts
    serverPort = 4000 + Math.floor(Math.random() * 1000);
    baseUrl = `http://localhost:${serverPort}`;
    
    // Create server
    server = new CCUIServer({ port: serverPort });
    
    // Replace the ProcessManager with one that uses fake HOME
    (server as any).processManager = new ClaudeProcessManager(
      'node_modules/.bin/claude',
      { HOME: tempHomeDir }
    );
    
    // Re-setup the ProcessManager integration since we replaced it
    (server as any).setupProcessManagerIntegration();
    
    await server.start();
  }, 15000);

  afterAll(async () => {
    if (server) {
      await server.stop();
      // Small delay to ensure port is fully released
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Clean up temporary directory
    try {
      await fs.rm(tempHomeDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Restore all mocks to prevent interference with other tests
    jest.restoreAllMocks();
  }, 15000);

  describe('Claude CLI with API Error', () => {
    it('should handle real Claude CLI with API error in fake home', async () => {
      const workingDirectory = process.cwd();
      const initialPrompt = 'Say 1+1=2 and quit';
      
      // 1. Start conversation with real Claude CLI
      const startResponse = await fetch(`${baseUrl}/api/conversations/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workingDirectory,
          initialPrompt
        })
      });
      
      expect(startResponse.ok).toBe(true);
      const startData = await startResponse.json() as { sessionId: string; streamUrl: string };
      expect(startData).toHaveProperty('sessionId');
      expect(startData).toHaveProperty('streamUrl');
      
      const streamingId = startData.sessionId;
      
      // 2. Connect to stream and collect messages  
      const messages: any[] = [];
      let hasApiError = false;
      let streamClosed = false;
      
      // Use EventSource for better performance (like existing streaming test)
      const streamUrl = `${baseUrl}${startData.streamUrl}`;
      const eventSource = new EventSource(streamUrl);
      
      // Set up promise to wait for API error detection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          eventSource.close();
          reject(new Error('Streaming timeout - API error not detected'));
        }, 8000);
        
        eventSource.onmessage = (event: any) => {
          try {
            const data = JSON.parse(event.data);
            messages.push(data);
            
            // Check for API error in message content
            const content = JSON.stringify(data);
            if (content.includes('Invalid API key') || 
                content.includes('API key') ||
                content.includes('login') ||
                content.includes('authentication')) {
              hasApiError = true;
            }
            
            // Exit early once we have the API error
            if (data.type === 'closed' || hasApiError) {
              streamClosed = true;
              clearTimeout(timeout);
              eventSource.close();
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            eventSource.close();
            reject(error);
          }
        };
        
        eventSource.onerror = (error: any) => {
          if (!streamClosed) {
            clearTimeout(timeout);
            reject(error);
          }
        };
      });
      
      // 3. Verify we received API error in streaming
      expect(messages.length).toBeGreaterThan(0);
      expect(hasApiError).toBe(true);
      
      // 4. Test the list and get conversation APIs (they work with existing conversations)
      const listResponse = await fetch(`${baseUrl}/api/conversations`);
      expect(listResponse.ok).toBe(true);
      
      const listData = await listResponse.json() as { conversations: any[], total: number };
      expect(listData.conversations).toBeDefined();
      expect(Array.isArray(listData.conversations)).toBe(true);
      
      // 5. If we have conversations, test the get conversation API
      if (listData.conversations.length > 0) {
        const firstConversation = listData.conversations[0];
        const detailsResponse = await fetch(`${baseUrl}/api/conversations/${firstConversation.sessionId}`);
        expect(detailsResponse.ok).toBe(true);
        
        const conversationDetails = await detailsResponse.json() as any;
        expect(conversationDetails).toBeDefined();
        expect(conversationDetails.messages).toBeDefined();
      }
    }, 15000);
  });
});
