import { ClaudeHistoryReader } from '@/services/claude-history-reader';
import { ConversationListQuery } from '@/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('ClaudeHistoryReader', () => {
  let reader: ClaudeHistoryReader;
  let tempClaudeHome: string;
  let tempProjectsDir: string;

  beforeEach(async () => {
    // Create temporary Claude home directory structure
    tempClaudeHome = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-test-'));
    tempProjectsDir = path.join(tempClaudeHome, 'projects');
    await fs.mkdir(tempProjectsDir, { recursive: true });
    
    reader = new ClaudeHistoryReader(tempClaudeHome);
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempClaudeHome, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should use provided Claude home path', () => {
      const customPath = '/custom/.claude';
      const customReader = new ClaudeHistoryReader(customPath);
      expect(customReader.homePath).toBe(customPath);
    });

    it('should use default home directory if not provided', () => {
      const defaultReader = new ClaudeHistoryReader();
      expect(defaultReader.homePath).toBe(path.join(os.homedir(), '.claude'));
    });
  });

  describe('listConversations', () => {
    it('should return empty result when projects directory does not exist', async () => {
      // Remove the projects directory
      await fs.rm(tempProjectsDir, { recursive: true, force: true });
      
      const result = await reader.listConversations();
      
      expect(result).toEqual({
        conversations: [],
        total: 0
      });
    });

    it('should handle filesystem errors properly', async () => {
      // Create a file where we expect a directory to cause an error
      const fileInsteadOfDir = path.join(tempClaudeHome, 'projects');
      await fs.rm(fileInsteadOfDir, { recursive: true, force: true });
      await fs.writeFile(fileInsteadOfDir, 'not a directory');
      
      const invalidReader = new ClaudeHistoryReader(tempClaudeHome);
      
      await expect(invalidReader.listConversations()).rejects.toThrow('Failed to read conversation history');
    });

    it('should process project directories and conversations correctly', async () => {
      // Create project directory structure
      const projectDir = path.join(tempProjectsDir, '-Users-username-project-name');
      await fs.mkdir(projectDir, { recursive: true });
      
      // Create conversation JSONL file with realistic Claude format
      const sessionId = '4f35e220-c435-4cf7-b9b9-f40426042847';
      const conversationFile = path.join(projectDir, `${sessionId}.jsonl`);
      
      const conversationContent = `{"type":"summary","summary":"Example Development Session","leafUuid":"42f8e822-c264-4c7e-b42c-5ba1c4810245"}
{"parentUuid":null,"isSidechain":false,"userType":"external","cwd":"/Users/username/project","sessionId":"${sessionId}","version":"1.0.3","type":"user","message":{"role":"user","content":"Please help me add a new config file to my project"},"uuid":"9ff29d57-8b28-4da9-8e7f-b0e4e7e2ba46","timestamp":"2025-05-26T07:27:40.079Z"}
{"parentUuid":"9ff29d57-8b28-4da9-8e7f-b0e4e7e2ba46","isSidechain":false,"userType":"external","cwd":"/Users/username/project","sessionId":"${sessionId}","version":"1.0.3","message":{"id":"msg_01Example123","type":"message","role":"assistant","model":"claude-opus-4-20250514","content":[{"type":"text","text":"I'll help you add a new config file."}],"stop_reason":"end_turn","usage":{"input_tokens":100,"output_tokens":200}},"costUSD":0.00250,"durationMs":2500,"type":"assistant","uuid":"04d6794d-6350-4d37-abe4-f6f643fdf83d","timestamp":"2025-05-26T07:27:42.579Z"}`;
      
      await fs.writeFile(conversationFile, conversationContent);
      
      const result = await reader.listConversations();
      
      expect(result.conversations).toHaveLength(1);
      expect(result.total).toBe(1);
      
      const conversation = result.conversations[0];
      expect(conversation.sessionId).toBe(sessionId);
      expect(conversation.projectPath).toBe('/Users/username/project/name');
      expect(conversation.summary).toBe('Example Development Session');
      expect(conversation.messageCount).toBe(2); // user + assistant message
      expect(conversation.createdAt).toBeDefined();
      expect(conversation.updatedAt).toBeDefined();
    });

    it('should apply filters correctly', async () => {
      // Create multiple project directories
      const project1Dir = path.join(tempProjectsDir, '-Users-username-project1');
      const project2Dir = path.join(tempProjectsDir, '-Users-username-project2');
      await fs.mkdir(project1Dir, { recursive: true });
      await fs.mkdir(project2Dir, { recursive: true });
      
      // Create conversations in different projects
      const session1 = 'session-1';
      const session2 = 'session-2';
      
      const conversation1Content = `{"type":"summary","summary":"Project 1 Session"}
{"type":"user","message":{"role":"user","content":"Hello"},"uuid":"msg1","timestamp":"2024-01-01T00:00:00Z","sessionId":"${session1}"}`;
      
      const conversation2Content = `{"type":"summary","summary":"Project 2 Session"}
{"type":"user","message":{"role":"user","content":"Hello"},"uuid":"msg2","timestamp":"2024-01-02T00:00:00Z","sessionId":"${session2}"}`;
      
      await fs.writeFile(path.join(project1Dir, `${session1}.jsonl`), conversation1Content);
      await fs.writeFile(path.join(project2Dir, `${session2}.jsonl`), conversation2Content);
      
      // Test filtering by project path
      const filtered = await reader.listConversations({
        projectPath: '/Users/username/project1'
      });
      
      expect(filtered.conversations).toHaveLength(1);
      expect(filtered.conversations[0].sessionId).toBe(session1);
    });

    it('should apply pagination correctly', async () => {
      // Create multiple conversations
      const projectDir = path.join(tempProjectsDir, '-Users-username-test-project');
      await fs.mkdir(projectDir, { recursive: true });
      
      // Create 5 conversations
      for (let i = 0; i < 5; i++) {
        const sessionId = `session-${i}`;
        const content = `{"type":"summary","summary":"Test Session ${i}"}
{"type":"user","message":{"role":"user","content":"Hello ${i}"},"uuid":"msg${i}","timestamp":"2024-01-0${i + 1}T00:00:00Z","sessionId":"${sessionId}"}`;
        
        await fs.writeFile(path.join(projectDir, `${sessionId}.jsonl`), content);
      }
      
      // Test pagination
      const paginated = await reader.listConversations({
        limit: 3,
        offset: 1
      });
      
      expect(paginated.conversations).toHaveLength(3);
      expect(paginated.total).toBe(5);
    });

    it('should sort conversations correctly', async () => {
      const projectDir = path.join(tempProjectsDir, '-Users-username-sort-test');
      await fs.mkdir(projectDir, { recursive: true });
      
      // Create conversations with different timestamps
      const sessions = [
        { id: 'session-1', date: '2024-01-03T00:00:00Z' },
        { id: 'session-2', date: '2024-01-01T00:00:00Z' },
        { id: 'session-3', date: '2024-01-02T00:00:00Z' }
      ];
      
      for (const session of sessions) {
        const content = `{"type":"summary","summary":"Test Session"}
{"type":"user","message":{"role":"user","content":"Hello"},"uuid":"msg","timestamp":"${session.date}","sessionId":"${session.id}"}`;
        
        await fs.writeFile(path.join(projectDir, `${session.id}.jsonl`), content);
        
        // Set file modification time to match timestamp
        const timestamp = new Date(session.date);
        await fs.utimes(path.join(projectDir, `${session.id}.jsonl`), timestamp, timestamp);
      }
      
      // Test sorting by created date ascending
      const sorted = await reader.listConversations({
        sortBy: 'created',
        order: 'asc'
      });
      
      expect(sorted.conversations[0].sessionId).toBe('session-2'); // earliest
      expect(sorted.conversations[2].sessionId).toBe('session-1'); // latest
    });
  });

  describe('fetchConversation', () => {
    it('should throw error if conversation not found', async () => {
      await expect(reader.fetchConversation('non-existent')).rejects.toThrow('Conversation non-existent not found');
    });

    it('should parse JSONL file correctly', async () => {
      // Create project directory
      const projectDir = path.join(tempProjectsDir, '-Users-username-test');
      await fs.mkdir(projectDir, { recursive: true });
      
      const sessionId = 'test-session-123';
      const conversationFile = path.join(projectDir, `${sessionId}.jsonl`);
      
      const fileContent = `{"type":"summary","summary":"Test conversation"}
{"parentUuid":null,"type":"user","message":{"role":"user","content":"Hello"},"uuid":"msg1","timestamp":"2024-01-01T00:00:00Z","sessionId":"${sessionId}"}
{"parentUuid":"msg1","type":"assistant","message":{"role":"assistant","content":"Hi there","id":"msg_123"},"uuid":"msg2","timestamp":"2024-01-01T00:00:01Z","sessionId":"${sessionId}","costUSD":0.001,"durationMs":1000}`;

      await fs.writeFile(conversationFile, fileContent);

      const messages = await reader.fetchConversation(sessionId);
      
      expect(messages).toHaveLength(2); // Summary line should be filtered out
      expect(messages[0].type).toBe('user');
      expect(messages[0].uuid).toBe('msg1');
      expect(messages[0].sessionId).toBe(sessionId);
      expect(messages[1].type).toBe('assistant');
      expect(messages[1].uuid).toBe('msg2');
      expect(messages[1].costUSD).toBe(0.001);
      expect(messages[1].durationMs).toBe(1000);
    });

    it('should handle malformed JSON lines gracefully', async () => {
      const projectDir = path.join(tempProjectsDir, '-Users-username-malformed');
      await fs.mkdir(projectDir, { recursive: true });
      
      const sessionId = 'test-session-malformed';
      const conversationFile = path.join(projectDir, `${sessionId}.jsonl`);
      
      const fileContent = `{"type":"user","uuid":"msg1","valid":true,"sessionId":"${sessionId}"}
{invalid json line}
{"type":"assistant","uuid":"msg2","also":"valid","sessionId":"${sessionId}"}`;

      await fs.writeFile(conversationFile, fileContent);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const messages = await reader.fetchConversation(sessionId);
      
      expect(messages).toHaveLength(2); // Only valid lines
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse line'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should parse single line JSONL with complex content and maintain tool use input properties', async () => {
      const projectDir = path.join(tempProjectsDir, '-Users-example-project');
      await fs.mkdir(projectDir, { recursive: true });
      
      const sessionId = '4f35e220-c435-4cf7-b9b9-f40426042847';
      const conversationFile = path.join(projectDir, `${sessionId}.jsonl`);
      
      const complexJsonLine = `{"parentUuid": "b72a5272-ecd5-4b58-b8e6-87483e9acad6", "isSidechain": false, "userType": "external", "cwd": "/Users/example/project", "sessionId": "${sessionId}", "version": "1.0.3", "message": {"id": "msg_02Example456", "type": "message", "role": "assistant", "model": "claude-opus-4-20250514", "content": [{"type": "text", "text": "Let me check the current directory structure."}, {"type": "tool_use", "id": "toolu_02LSExample", "name": "LS", "input": {"path": "/Users/example/project"}}], "stop_reason": "tool_use", "stop_sequence": null, "usage": {"input_tokens": 150, "cache_creation_input_tokens": 0, "cache_read_input_tokens": 1200, "output_tokens": 80, "service_tier": "standard"}}, "costUSD": 0.00180, "durationMs": 1800, "type": "assistant", "uuid": "2c333acb-b9f2-41bf-b2d1-d20f0fa413e5", "timestamp": "2025-05-26T07:27:44.400Z"}`;

      await fs.writeFile(conversationFile, complexJsonLine);

      const messages = await reader.fetchConversation(sessionId);
      
      expect(messages).toHaveLength(1);
      
      const message = messages[0];
      expect(message.type).toBe('assistant');
      expect(message.uuid).toBe('2c333acb-b9f2-41bf-b2d1-d20f0fa413e5');
      expect(message.parentUuid).toBe('b72a5272-ecd5-4b58-b8e6-87483e9acad6');
      expect(message.sessionId).toBe(sessionId);
      expect(message.costUSD).toBe(0.00180);
      expect(message.durationMs).toBe(1800);
      
      // Verify message content structure
      expect(message.message.id).toBe('msg_02Example456');
      expect(message.message.role).toBe('assistant');
      expect(message.message.model).toBe('claude-opus-4-20250514');
      expect(message.message.content).toHaveLength(2);
      
      // Verify text content
      const textContent = message.message.content[0];
      expect(textContent.type).toBe('text');
      expect(textContent.text).toBe('Let me check the current directory structure.');
      
      // Verify tool use content with maintained input properties
      const toolUseContent = message.message.content[1];
      expect(toolUseContent.type).toBe('tool_use');
      expect(toolUseContent.id).toBe('toolu_02LSExample');
      expect(toolUseContent.name).toBe('LS');
      expect(toolUseContent.input).toEqual({
        path: '/Users/example/project'
      });
      
      // Verify usage information
      expect(message.message.usage.input_tokens).toBe(150);
      expect(message.message.usage.output_tokens).toBe(80);
      expect(message.message.usage.service_tier).toBe('standard');
    });

    it('should handle file read errors', async () => {
      // Create a reader with invalid path to trigger read error
      const invalidReader = new ClaudeHistoryReader('/invalid/path');
      
      await expect(invalidReader.fetchConversation('any-session')).rejects.toThrow("Conversation any-session not found");
    });
  });

  describe('getConversationMetadata', () => {
    it('should extract metadata from conversation file', async () => {
      const projectDir = path.join(tempProjectsDir, '-Users-username-metadata-test');
      await fs.mkdir(projectDir, { recursive: true });
      
      const sessionId = 'metadata-session';
      const conversationFile = path.join(projectDir, `${sessionId}.jsonl`);
      
      const fileContent = `{"type":"summary","summary":"Metadata Test Session"}
{"cwd":"/Users/username/project","message":{"model":"claude-opus-4-20250514"},"costUSD":0.005,"durationMs":2000,"sessionId":"${sessionId}"}
{"costUSD":0.003,"durationMs":1500,"sessionId":"${sessionId}"}`;

      await fs.writeFile(conversationFile, fileContent);

      const metadata = await reader.getConversationMetadata(sessionId);
      
      expect(metadata).not.toBeNull();
      expect(metadata!.summary).toBe('Metadata Test Session');
      expect(metadata!.projectPath).toBe('/Users/username/project');
      expect(metadata!.model).toBe('claude-opus-4-20250514');
      expect(metadata!.totalCost).toBe(0.008); // 0.005 + 0.003
      expect(metadata!.totalDuration).toBe(3500); // 2000 + 1500
    });

    it('should return null for non-existent conversation', async () => {
      const metadata = await reader.getConversationMetadata('non-existent');
      expect(metadata).toBeNull();
    });
  });

  describe('private methods', () => {
    describe('decodeProjectPath', () => {
      it('should decode project path correctly', () => {
        const encoded = '-Users-username-project-name';
        const decoded = (reader as any).decodeProjectPath(encoded);
        expect(decoded).toBe('/Users/username/project/name');
      });

      it('should handle paths without dashes', () => {
        const encoded = 'project';
        const decoded = (reader as any).decodeProjectPath(encoded);
        expect(decoded).toBe('project');
      });

      it('should handle complex paths with multiple segments', () => {
        const encoded = '-home-user-Documents-my-project-folder';
        const decoded = (reader as any).decodeProjectPath(encoded);
        expect(decoded).toBe('/home/user/Documents/my/project/folder');
      });
    });

    describe('readFirstLine', () => {
      it('should read the first non-empty line from file', async () => {
        const testFile = path.join(tempClaudeHome, 'test.jsonl');
        const content = '\n\n{"type":"summary","summary":"First line"}\n{"type":"user"}';
        await fs.writeFile(testFile, content);

        const firstLine = await (reader as any).readFirstLine(testFile);
        expect(firstLine).toBe('{"type":"summary","summary":"First line"}');
      });

      it('should throw error if no non-empty lines found', async () => {
        const testFile = path.join(tempClaudeHome, 'empty.jsonl');
        await fs.writeFile(testFile, '\n\n\n');

        await expect((reader as any).readFirstLine(testFile)).rejects.toThrow('No non-empty lines found in file');
      });
    });

    describe('countMessages', () => {
      it('should count non-summary messages correctly', async () => {
        const testFile = path.join(tempClaudeHome, 'count.jsonl');
        const content = `{"type":"summary","summary":"Test"}
{"type":"user","message":"Hello"}
{"type":"assistant","message":"Hi"}
{"type":"user","message":"Bye"}`;
        await fs.writeFile(testFile, content);

        const count = await (reader as any).countMessages(testFile);
        expect(count).toBe(3); // Excludes summary line
      });

      it('should handle malformed JSON lines when counting', async () => {
        const testFile = path.join(tempClaudeHome, 'malformed-count.jsonl');
        const content = `{"type":"summary"}
{"type":"user","valid":true}
{invalid json}
{"type":"assistant","valid":true}`;
        await fs.writeFile(testFile, content);

        const count = await (reader as any).countMessages(testFile);
        expect(count).toBe(2); // Only counts valid non-summary lines
      });
    });
  });

  describe('filter and pagination utilities', () => {
    it('should handle null/undefined filters', () => {
      const conversations = [
        { sessionId: '1', projectPath: '/test', summary: 'Test', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', messageCount: 1 }
      ];

      const result = (reader as any).applyFilters(conversations, undefined);
      expect(result).toEqual(conversations);

      const result2 = (reader as any).applyPagination(conversations, undefined);
      expect(result2).toEqual(conversations);
    });

    it('should handle default pagination values', () => {
      const conversations = Array(30).fill(0).map((_, i) => ({
        sessionId: `session-${i}`,
        projectPath: '/test',
        summary: `Test ${i}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 1
      }));

      const result = (reader as any).applyPagination(conversations, {});
      expect(result).toHaveLength(20); // default limit
    });

    it('should handle sort by updated date', () => {
      const conversations = [
        {
          sessionId: '1',
          projectPath: '/test',
          summary: 'Test 1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-03T00:00:00Z',
          messageCount: 1
        },
        {
          sessionId: '2',
          projectPath: '/test',
          summary: 'Test 2',
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          messageCount: 1
        }
      ];

      const sorted = (reader as any).applyFilters(conversations, {
        sortBy: 'updated',
        order: 'desc'
      });
      
      expect(sorted[0].sessionId).toBe('1'); // most recently updated
    });
  });
});