import { ClaudeProcessManager } from '@/services/claude-process-manager';
import { ConversationConfig } from '@/types';
import { execSync } from 'child_process';

// Check if Claude CLI is available
function isClaudeCliAvailable(): boolean {
  try {
    execSync('claude --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('ClaudeProcessManager - Long Running Process', () => {
  let manager: ClaudeProcessManager;

  beforeAll(() => {
    if (!isClaudeCliAvailable()) {
      console.warn('⚠️  Claude CLI not found. Skipping tests that require Claude CLI.');
      console.warn('   Install Claude CLI to run these tests: https://claude.ai/cli');
    }
  });

  afterAll(async () => {
    // Final cleanup - ensure all processes are terminated
    if (manager) {
      const activeSessions = manager.getActiveSessions();
      for (const streamingId of activeSessions) {
        try {
          await manager.stopConversation(streamingId);
        } catch (error) {
          console.warn(`Failed to stop conversation ${streamingId} in afterAll:`, error);
        }
      }
    }
    
    // Extra time for cleanup
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  beforeEach(async () => {
    manager = new ClaudeProcessManager();
  });

  afterEach(async () => {
    // Clean up any active sessions
    const activeSessions = manager.getActiveSessions();
    for (const streamingId of activeSessions) {
      try {
        await manager.stopConversation(streamingId);
      } catch (error) {
        console.warn(`Failed to stop conversation ${streamingId}:`, error);
      }
    }
    
    // Give processes time to clean up
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('long-running process handling', () => {
    it('should handle long-running process with proper event handling', async () => {
      if (!isClaudeCliAvailable()) {
        console.warn('Skipping test: Claude CLI not available');
        return;
      }

      const config: ConversationConfig = {
        workingDirectory: process.cwd(),
        initialPrompt: 'Hello Claude! Please respond with "hello" and then stop.'
      };

      // Event tracking
      let outputEventCount = 0;
      let errorEventCount = 0;
      let processClosedReceived = false;
      let conversationCompleted = false;

      // Set up event listeners
      manager.on('claude-message', (data) => {
        expect(data).toBeDefined();
        expect(data.streamingId).toBeDefined();
        outputEventCount++;
        console.log(`📤 Output event ${outputEventCount} received for session ${data.streamingId}`, data);
      });

      manager.on('process-error', (data) => {
        expect(data).toBeDefined();
        expect(data.streamingId).toBeDefined();
        errorEventCount++;
        console.log(`❌ Error event ${errorEventCount} received for session ${data.streamingId}`, data);
      });

      manager.on('process-closed', (data) => {
        expect(data).toBeDefined();
        expect(data.streamingId).toBeDefined();
        processClosedReceived = true;
        conversationCompleted = true;
        console.log(`🔒 Process closed event received for session ${data.streamingId}`, data);
      });

      // Start conversation
      console.log('🚀 Starting long-running Claude process...');
      const streamingId = await manager.startConversation(config);
      
      expect(streamingId).toBeDefined();
      expect(typeof streamingId).toBe('string');
      expect(manager.isSessionActive(streamingId)).toBe(true);

      console.log(`📋 Process started with streaming ID: ${streamingId}`);
      console.log('⏳ Waiting for Claude process to complete naturally...');

      // Wait for the conversation to complete naturally
      // Use a polling approach to check if process is still active
      const maxWaitTime = 20000; // 20 seconds max
      const pollInterval = 500; // Check every 500ms
      let elapsedTime = 0;

      while (!conversationCompleted && elapsedTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        elapsedTime += pollInterval;
        
        // Check if session is still active
        if (!manager.isSessionActive(streamingId)) {
          conversationCompleted = true;
          break;
        }
      }

      // Give a bit more time for final events to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log(`📊 Final event counts - Output: ${outputEventCount}, Error: ${errorEventCount}, Process Closed: ${processClosedReceived}`);

      // Verify we received the expected events
      expect(outputEventCount).toBeGreaterThanOrEqual(1); // At least 1 output event
      expect(errorEventCount).toBeLessThanOrEqual(0); // At least 0 error events (stderr may not always occur)
      expect(processClosedReceived).toBe(true); // Process should have closed naturally
      expect(manager.isSessionActive(streamingId)).toBe(false); // Session should be inactive

      console.log('✅ Long-running process test completed successfully');
    }, 25000); // 25 second timeout to allow for natural completion
  });
});