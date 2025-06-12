import { ClaudeProcessManager } from '@/services/claude-process-manager';
import { ConversationConfig } from '@/types';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

describe('ClaudeProcessManager', () => {
  let manager: ClaudeProcessManager;
  let tempDir: string;
  let mcpConfigPath: string;

  beforeEach(async () => {
    console.log('[TEST DEBUG] Starting beforeEach');
    // Create temporary directory for test MCP config
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ccui-test-'));
    mcpConfigPath = path.join(tempDir, 'mcp-config.json');
    console.log('[TEST DEBUG] Created temp dir:', tempDir);
    
    // Create minimal MCP config for testing
    const mcpConfig = {
      mcpServers: {}
    };
    await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
    console.log('[TEST DEBUG] Created MCP config at:', mcpConfigPath);
    
    manager = new ClaudeProcessManager(mcpConfigPath);
    console.log('[TEST DEBUG] Created ClaudeProcessManager');
  });

  afterEach(async () => {
    // Clean up any active sessions
    const activeSessions = manager.getActiveSessions();
    for (const sessionId of activeSessions) {
      await manager.stopConversation(sessionId);
    }
    
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should initialize with MCP config path', () => {
      expect(manager).toBeDefined();
      expect(manager.getActiveSessions()).toEqual([]);
    });
  });

  describe('buildClaudeArgs', () => {
    it('should build correct arguments for basic configuration', () => {
      const config: ConversationConfig = {
        workingDirectory: '/test/dir',
        initialPrompt: 'Hello Claude'
      };

      const args = (manager as any).buildClaudeArgs(config);
      
      expect(args).toContain('-p'); // Print mode
      expect(args).toContain('--output-format');
      expect(args).toContain('stream-json');
      expect(args).toContain('--mcp-config');
      expect(args).toContain(mcpConfigPath);
      expect(args).toContain('Hello Claude'); // Initial prompt should be last
    });

    it('should include working directory when specified', () => {
      const config: ConversationConfig = {
        workingDirectory: '/test/dir',
        initialPrompt: 'Hello Claude'
      };

      const args = (manager as any).buildClaudeArgs(config);
      
      expect(args).toContain('--add-dir');
      expect(args).toContain('/test/dir');
    });

    it('should include model when specified', () => {
      const config: ConversationConfig = {
        workingDirectory: '/test/dir',
        initialPrompt: 'Hello Claude',
        model: 'claude-opus-4-20250514'
      };

      const args = (manager as any).buildClaudeArgs(config);
      
      expect(args).toContain('--model');
      expect(args).toContain('claude-opus-4-20250514');
    });

    it('should include allowed tools when specified', () => {
      const config: ConversationConfig = {
        workingDirectory: '/test/dir',
        initialPrompt: 'Hello Claude',
        allowedTools: ['Bash', 'Read', 'Write']
      };

      const args = (manager as any).buildClaudeArgs(config);
      
      expect(args).toContain('--allowedTools');
      expect(args).toContain('Bash,Read,Write');
    });

    it('should include disallowed tools when specified', () => {
      const config: ConversationConfig = {
        workingDirectory: '/test/dir',
        initialPrompt: 'Hello Claude',
        disallowedTools: ['WebSearch']
      };

      const args = (manager as any).buildClaudeArgs(config);
      
      expect(args).toContain('--disallowedTools');
      expect(args).toContain('WebSearch');
    });

    it('should include system prompt when specified', () => {
      const config: ConversationConfig = {
        workingDirectory: '/test/dir',
        initialPrompt: 'Hello Claude',
        systemPrompt: 'You are a helpful assistant'
      };

      const args = (manager as any).buildClaudeArgs(config);
      
      expect(args).toContain('--system-prompt');
      expect(args).toContain('You are a helpful assistant');
    });

    it('should include permission prompt tool', () => {
      const config: ConversationConfig = {
        workingDirectory: '/test/dir',
        initialPrompt: 'Hello Claude'
      };

      const args = (manager as any).buildClaudeArgs(config);
      
      expect(args).toContain('--permission-prompt-tool');
      expect(args).toContain('mcp__ccui__permission_prompt');
    });
  });

  describe('startConversation', () => {
    it('should start a conversation and return session ID', async () => {
      console.log('[TEST DEBUG] Starting conversation test');
      const config: ConversationConfig = {
        workingDirectory: process.cwd(), // Use current directory for testing
        initialPrompt: 'Hello, Claude! Please respond with just "Hello" and nothing else.'
      };
      console.log('[TEST DEBUG] Created config:', config);

      console.log('[TEST DEBUG] Calling startConversation...');
      const sessionId = await manager.startConversation(config);
      console.log('[TEST DEBUG] Got sessionId:', sessionId);
      
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);
      
      // Session should be tracked as active
      expect(manager.getActiveSessions()).toContain(sessionId);
      expect(manager.isSessionActive(sessionId)).toBe(true);
      console.log('[TEST DEBUG] Conversation test completed');
    }, 30000); // Increase timeout for real Claude CLI

    it('should emit claude-message events', (done) => {
      const config: ConversationConfig = {
        workingDirectory: process.cwd(),
        initialPrompt: 'Hello, respond with just "test" and nothing else.'
      };

      manager.on('claude-message', ({ sessionId, message }) => {
        expect(sessionId).toBeDefined();
        expect(message).toBeDefined();
        
        // Should receive Claude's response messages
        if (message.type === 'assistant') {
          expect(message.message).toBeDefined();
          done();
        }
      });

      manager.startConversation(config);
    }, 30000);

    it('should handle invalid working directory', async () => {
      const config: ConversationConfig = {
        workingDirectory: '/nonexistent/directory/that/does/not/exist',
        initialPrompt: 'Hello Claude'
      };

      await expect(manager.startConversation(config)).rejects.toThrow();
    });
  });

  describe('sendInput', () => {
    let sessionId: string;

    beforeEach(async () => {
      const config: ConversationConfig = {
        workingDirectory: process.cwd(),
        initialPrompt: 'Hello, I will send you more messages. Please respond briefly.'
      };
      sessionId = await manager.startConversation(config);
      
      // Wait a moment for the conversation to start
      await new Promise(resolve => setTimeout(resolve, 2000));
    }, 30000);

    it('should send input to active conversation', async () => {
      const input = 'Please respond with just "received" and nothing else.';
      
      await expect(manager.sendInput(sessionId, input)).resolves.toBeUndefined();
    }, 15000);

    it('should throw error if session not found', async () => {
      await expect(manager.sendInput('non-existent-session', 'test'))
        .rejects.toThrow('No active session found');
    });
  });

  describe('stopConversation', () => {
    it('should stop active conversation', async () => {
      const config: ConversationConfig = {
        workingDirectory: process.cwd(),
        initialPrompt: 'Hello Claude'
      };
      
      const sessionId = await manager.startConversation(config);
      expect(manager.isSessionActive(sessionId)).toBe(true);
      
      const result = await manager.stopConversation(sessionId);
      expect(result).toBe(true);
      expect(manager.isSessionActive(sessionId)).toBe(false);
    }, 30000);

    it('should return false if session not found', async () => {
      const result = await manager.stopConversation('non-existent');
      expect(result).toBe(false);
    });

    it('should emit process-closed event', (done) => {
      const config: ConversationConfig = {
        workingDirectory: process.cwd(),
        initialPrompt: 'Hello Claude'
      };

      manager.on('process-closed', ({ sessionId, code }) => {
        expect(sessionId).toBeDefined();
        expect(typeof code).toBe('number');
        done();
      });

      manager.startConversation(config).then(sessionId => {
        setTimeout(() => {
          manager.stopConversation(sessionId);
        }, 2000);
      });
    }, 30000);
  });

  describe('session management', () => {
    it('should track multiple active sessions', async () => {
      const config1: ConversationConfig = {
        workingDirectory: process.cwd(),
        initialPrompt: 'Session 1'
      };
      
      const config2: ConversationConfig = {
        workingDirectory: process.cwd(),
        initialPrompt: 'Session 2'
      };

      const sessionId1 = await manager.startConversation(config1);
      const sessionId2 = await manager.startConversation(config2);

      const activeSessions = manager.getActiveSessions();
      expect(activeSessions).toContain(sessionId1);
      expect(activeSessions).toContain(sessionId2);
      expect(activeSessions).toHaveLength(2);
    }, 45000);

    it('should return empty array when no sessions', () => {
      expect(manager.getActiveSessions()).toEqual([]);
    });

    it('should correctly report session status', async () => {
      const config: ConversationConfig = {
        workingDirectory: process.cwd(),
        initialPrompt: 'Hello Claude'
      };

      expect(manager.isSessionActive('non-existent')).toBe(false);
      
      const sessionId = await manager.startConversation(config);
      expect(manager.isSessionActive(sessionId)).toBe(true);
      
      await manager.stopConversation(sessionId);
      expect(manager.isSessionActive(sessionId)).toBe(false);
    }, 30000);
  });

  describe('error handling', () => {
    it('should handle process errors gracefully', (done) => {
      const config: ConversationConfig = {
        workingDirectory: '/nonexistent/directory',
        initialPrompt: 'This should fail'
      };

      manager.on('process-error', ({ sessionId, error }) => {
        expect(sessionId).toBeDefined();
        expect(error).toBeDefined();
        done();
      });

      // This should trigger an error
      manager.startConversation(config).catch(() => {
        // Expected to fail
      });
    }, 15000);
  });
});