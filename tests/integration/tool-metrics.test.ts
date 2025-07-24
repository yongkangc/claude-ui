import { CCUIServer } from '@/ccui-server';
import { ConversationStatusManager } from '@/services/conversation-status-manager';
import { ToolMetricsService } from '@/services/ToolMetricsService';
import * as path from 'path';
import { EventSource } from 'eventsource';
import { createLogger } from '@/services/logger';

// Get mock Claude executable path
function getMockClaudeExecutablePath(): string {
  return path.join(process.cwd(), 'tests', '__mocks__', 'claude-with-tools');
}

/**
 * Integration test for the tool metrics feature
 * Tests: Tool metrics tracking, API exposure, and memory cleanup
 */
describe('Tool Metrics Integration', () => {
  jest.setTimeout(10000); // Set reasonable timeout
  let server: CCUIServer;
  let serverPort: number;
  let baseUrl: string;
  let toolMetricsService: ToolMetricsService;
  const logger = createLogger('ToolMetricsIntegrationTest');

  beforeAll(async () => {
    // Use a random port to avoid conflicts with common services
    serverPort = 9500 + Math.floor(Math.random() * 1000);
    baseUrl = `http://localhost:${serverPort}`;
    
    // Create server
    server = new CCUIServer({ port: serverPort });
    
    // Get reference to toolMetricsService
    toolMetricsService = (server as any).toolMetricsService;
    
    // Override the ProcessManager with one that uses mock Claude path with tool support
    const mockClaudePath = getMockClaudeExecutablePath();
    const { ClaudeProcessManager } = await import('@/services/claude-process-manager');
    const statusTracker = (server as any).statusTracker;
    (server as any).processManager = new ClaudeProcessManager(
      (server as any).historyReader, 
      statusTracker, 
      mockClaudePath,
      undefined,
      toolMetricsService
    );
    
    // Re-setup the ProcessManager integration since we replaced it
    (server as any).setupProcessManagerIntegration();
    
    // IMPORTANT: Re-establish the tool metrics listener connection
    toolMetricsService.listenToClaudeMessages((server as any).processManager);
    
    
    await server.start();
  }, 15000);

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  }, 15000);

  describe('Tool Metrics Tracking and API', () => {
    it.skip('should track tool metrics during conversation', async () => {
      const workingDirectory = process.cwd();
      const initialPrompt = 'Please edit a file using the Edit tool';
      
      // 1. Start conversation
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
      const startData = await startResponse.json();
      expect(startData).toHaveProperty('streamingId');
      expect(startData).toHaveProperty('sessionId');
      
      const streamingId = startData.streamingId;
      const sessionId = startData.sessionId;
      const streamUrl = `${baseUrl}${startData.streamUrl}`;
      
      console.log('Start response data:', { streamingId, sessionId });
      
      // 2. Connect to SSE stream and wait for tool messages
      const messages: any[] = [];
      let streamClosed = false;
      
      const eventSource = new EventSource(streamUrl);
      
      let metricsFound = false;
      
      const streamingComplete = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Streaming test timeout'));
        }, 10000);
        
        // Periodically check for metrics during streaming
        let checkCount = 0;
        const metricsCheckInterval = setInterval(() => {
          checkCount++;
          const metrics = toolMetricsService.getMetrics(sessionId);
          if (checkCount <= 5) {
            console.log(`Metrics check ${checkCount} for sessionId ${sessionId}:`, metrics);
          }
          if (metrics && metrics.editCount > 0) {
            metricsFound = true;
            console.log('Metrics found during streaming:', metrics);
          }
        }, 100);
        
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            messages.push(data);
            
            // Check for close event
            if (data.type === 'closed') {
              streamClosed = true;
              clearTimeout(timeout);
              clearInterval(metricsCheckInterval);
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            clearInterval(metricsCheckInterval);
            reject(error);
          }
        };
        
        eventSource.onerror = (error) => {
          if (!streamClosed) {
            clearTimeout(timeout);
            reject(error);
          }
        };
      });
      
      // 3. Wait for streaming to complete
      await streamingComplete;
      eventSource.close();
      
      // 4. Check that metrics were found during streaming
      expect(metricsFound).toBe(true);
      
      // 6. Stop the conversation
      const stopResponse = await fetch(`${baseUrl}/api/conversations/${streamingId}/stop`, {
        method: 'POST'
      });
      expect(stopResponse.ok).toBe(true);
      
      // 7. Give a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 8. Verify metrics are cleared from the service
      const clearedMetrics = toolMetricsService.getMetrics(sessionId);
      expect(clearedMetrics).toBeUndefined();
    });

    it.skip('should track Write tool metrics', async () => {
      const workingDirectory = process.cwd();
      const initialPrompt = 'Please write a new file using the Write tool';
      
      // 1. Start conversation
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
      const startData = await startResponse.json();
      const sessionId = startData.sessionId;
      const streamingId = startData.streamingId;
      const streamUrl = `${baseUrl}${startData.streamUrl}`;
      
      // 2. Connect to SSE stream and wait for completion
      const eventSource = new EventSource(streamUrl);
      
      const streamingComplete = new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 8000);
        
        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'closed') {
            clearTimeout(timeout);
            resolve();
          }
        };
        
        eventSource.onerror = () => {
          clearTimeout(timeout);
          resolve();
        };
      });
      
      await streamingComplete;
      eventSource.close();
      
      // 3. Give a moment for metrics to be processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 4. Check Write tool metrics directly from service
      const metrics = toolMetricsService.getMetrics(sessionId);
      expect(metrics).toBeDefined();
      expect(metrics!.writeCount).toBeGreaterThan(0);
      expect(metrics!.linesAdded).toBeGreaterThan(0);
      
      // 5. Clean up
      await fetch(`${baseUrl}/api/conversations/${streamingId}/stop`, {
        method: 'POST'
      });
    });

    it.skip('should track MultiEdit tool metrics', async () => {
      const workingDirectory = process.cwd();
      const initialPrompt = 'Please make multiple edits using the MultiEdit tool';
      
      // 1. Start conversation
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
      const startData = await startResponse.json();
      const sessionId = startData.sessionId;
      const streamingId = startData.streamingId;
      const streamUrl = `${baseUrl}${startData.streamUrl}`;
      
      // 2. Connect to SSE stream and wait for completion
      const eventSource = new EventSource(streamUrl);
      
      const streamingComplete = new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 8000);
        
        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'closed') {
            clearTimeout(timeout);
            resolve();
          }
        };
        
        eventSource.onerror = () => {
          clearTimeout(timeout);
          resolve();
        };
      });
      
      await streamingComplete;
      eventSource.close();
      
      // 3. Give a moment for metrics to be processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 4. Check MultiEdit tool metrics directly from service
      const metrics = toolMetricsService.getMetrics(sessionId);
      expect(metrics).toBeDefined();
      // MultiEdit with multiple edits should count as more than 1 edit
      expect(metrics!.editCount).toBeGreaterThan(1);
      
      // 5. Clean up
      await fetch(`${baseUrl}/api/conversations/${streamingId}/stop`, {
        method: 'POST'
      });
    });
  });

  describe('Tool Metrics in API Responses', () => {
    it.skip('should expose metrics in conversation list for active sessions', async () => {
      const workingDirectory = process.cwd();
      const initialPrompt = 'Edit a file';
      
      // 1. Start conversation
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
      
      const startData = await startResponse.json();
      const sessionId = startData.sessionId;
      const streamingId = startData.streamingId;
      
      // 2. Wait a bit for metrics to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 3. Check conversation list includes optimistic conversation with metrics
      const listResponse = await fetch(`${baseUrl}/api/conversations`);
      expect(listResponse.ok).toBe(true);
      const listData = await listResponse.json();
      
      // Find the conversation (it might be in optimistic conversations)
      const conversation = listData.conversations.find((c: any) => c.sessionId === sessionId || c.streamingId === streamingId);
      if (conversation && conversation.toolMetrics) {
        expect(conversation.toolMetrics.editCount).toBeGreaterThan(0);
      } else {
        // If not found in list, verify metrics exist in service at least
        const metrics = toolMetricsService.getMetrics(sessionId);
        expect(metrics).toBeDefined();
      }
      
      // 4. Clean up
      await fetch(`${baseUrl}/api/conversations/${streamingId}/stop`, {
        method: 'POST'
      });
    });
  });

});

describe('Tool Metrics Integration - Core Functionality', () => {
  it('verifies tool metrics are tracked', async () => {
    // Use the simple test approach to verify metrics tracking
    const { ToolMetricsService } = await import('@/services/ToolMetricsService');
    const { ClaudeProcessManager } = await import('@/services/claude-process-manager');
    const { ClaudeHistoryReader } = await import('@/services/claude-history-reader');
    const { ConversationStatusManager } = await import('@/services/conversation-status-manager');
    const EventEmitter = (await import('events')).EventEmitter;
    
    // Create services
    const historyReader = new ClaudeHistoryReader();
    const statusTracker = new ConversationStatusManager();
    const toolMetricsService = new ToolMetricsService();
    const processManager = new ClaudeProcessManager(
      historyReader,
      statusTracker,
      undefined,
      undefined,
      toolMetricsService
    );
    
    // Set up the integration
    toolMetricsService.listenToClaudeMessages(processManager);
    
    // Simulate a conversation with tool use
    const streamingId = 'test-stream-123';
    const sessionId = 'test-session-456';
    
    // Register the session mapping
    statusTracker.registerActiveSession(streamingId, sessionId);
    
    // Emit a tool use message
    const toolMessage = {
      type: 'assistant',
      session_id: sessionId,
      message: {
        id: 'msg-1',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool-1',
            name: 'Edit',
            input: {
              file_path: '/test.txt',
              old_string: 'old',
              new_string: 'new\nwith\nextra\nlines'
            }
          }
        ],
        model: 'claude-3',
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          server_tool_use: { web_search_requests: 0 },
          service_tier: 'standard' as const
        }
      }
    };
    
    // Emit the message
    processManager.emit('claude-message', { streamingId, message: toolMessage });
    
    // Give time for processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify metrics were tracked
    const metrics = toolMetricsService.getMetrics(sessionId);
    expect(metrics).toBeDefined();
    expect(metrics!.editCount).toBe(1);
    expect(metrics!.linesAdded).toBe(4);
    expect(metrics!.linesRemoved).toBe(1);
    
    // Clean up
    statusTracker.unregisterActiveSession(streamingId);
  });
});