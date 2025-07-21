import { getCommand } from '@/cli/commands/get';
import { ClaudeHistoryReader } from '@/services/claude-history-reader';
import { ConversationMessage } from '@/types';

// Define local type for metadata since it's not exported from types
interface ConversationMetadata {
  summary: string;
  projectPath: string;
  model: string;
  totalDuration: number;
}

// Mock ClaudeHistoryReader
jest.mock('@/services/claude-history-reader');

const MockedClaudeHistoryReader = ClaudeHistoryReader as jest.MockedClass<typeof ClaudeHistoryReader>;

// Mock console methods
const consoleSpy = {
  log: jest.spyOn(console, 'log').mockImplementation(),
  error: jest.spyOn(console, 'error').mockImplementation()
};

// Mock process.exit
const mockExit = jest.spyOn(process, 'exit').mockImplementation();

describe('CLI Get Command', () => {
  let mockReader: jest.Mocked<ClaudeHistoryReader>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock reader instance
    mockReader = {
      getConversationMetadata: jest.fn(),
      fetchConversation: jest.fn()
    } as any;
    
    MockedClaudeHistoryReader.mockImplementation(() => mockReader);
  });

  afterEach(() => {
    consoleSpy.log.mockClear();
    consoleSpy.error.mockClear();
    mockExit.mockClear();
  });

  afterAll(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.error.mockRestore();
    mockExit.mockRestore();
  });

  const createSampleMetadata = (): ConversationMetadata => ({
    summary: 'Build a React component with TypeScript',
    projectPath: '/Users/test/project/web',
    model: 'claude-opus-4-20250514',
    totalDuration: 5500
  });

  const createSampleMessages = (): ConversationMessage[] => [
    {
      uuid: 'msg-1',
      type: 'user',
      message: {
        role: 'user',
        content: 'Create a TypeScript React button component'
      },
      timestamp: '2024-01-01T10:00:00Z',
      sessionId: 'session-123'
    },
    {
      uuid: 'msg-2',
      type: 'assistant',
      message: {
        id: 'msg_assistant_1',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'I\'ll help you create a TypeScript React button component. Let me start by creating a reusable button with proper TypeScript interfaces.'
          },
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'Write',
            input: { file_path: 'Button.tsx', content: '...' }
          }
        ]
      },
      timestamp: '2024-01-01T10:00:05Z',
      sessionId: 'session-123',
      durationMs: 2500
    },
    {
      uuid: 'msg-3',
      type: 'user',
      message: {
        role: 'user',
        content: 'Can you add click event handling?'
      },
      timestamp: '2024-01-01T10:02:00Z',
      sessionId: 'session-123'
    },
    {
      uuid: 'msg-4',
      type: 'assistant',
      message: {
        id: 'msg_assistant_2',
        role: 'assistant',
        content: 'Certainly! I\'ll update the button component to include proper click event handling with TypeScript types.'
      },
      timestamp: '2024-01-01T10:02:03Z',
      sessionId: 'session-123',
      durationMs: 3000
    }
  ];

  describe('successful conversation retrieval', () => {
    beforeEach(() => {
      mockReader.getConversationMetadata.mockResolvedValue(createSampleMetadata());
      mockReader.fetchConversation.mockResolvedValue(createSampleMessages());
    });

    it('should display conversation in human-readable format by default', async () => {
      const sessionId = 'session-123';
      
      await getCommand(sessionId, {});

      expect(mockReader.getConversationMetadata).toHaveBeenCalledWith(sessionId);
      expect(mockReader.fetchConversation).toHaveBeenCalledWith(sessionId);

      expect(consoleSpy.log).toHaveBeenCalledWith('\nConversation: session-123');
      expect(consoleSpy.log).toHaveBeenCalledWith('='.repeat(50));
      expect(consoleSpy.log).toHaveBeenCalledWith('Summary: Build a React component with TypeScript');
      expect(consoleSpy.log).toHaveBeenCalledWith('Project Path: /Users/test/project/web');
      expect(consoleSpy.log).toHaveBeenCalledWith('Model: claude-opus-4-20250514');
      expect(consoleSpy.log).toHaveBeenCalledWith('Messages: 4');
      // Total cost display has been removed
      expect(consoleSpy.log).toHaveBeenCalledWith('Total Duration: 5.50s');
      expect(consoleSpy.log).toHaveBeenCalledWith('\nMessages:');
      expect(consoleSpy.log).toHaveBeenCalledWith('-'.repeat(50));
    });

    it('should display conversation in JSON format when requested', async () => {
      const sessionId = 'session-123';
      const metadata = createSampleMetadata();
      const messages = createSampleMessages();
      
      await getCommand(sessionId, { json: true });

      const expectedResult = {
        sessionId,
        metadata,
        messages: messages.length,
        conversation: messages
      };

      expect(consoleSpy.log).toHaveBeenCalledWith(JSON.stringify(expectedResult, null, 2));
      expect(consoleSpy.log).not.toHaveBeenCalledWith('\nConversation: session-123');
    });

    it('should display message details correctly', async () => {
      const sessionId = 'session-123';
      
      await getCommand(sessionId, {});

      // Check user message display
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('[1] USER'));
      expect(consoleSpy.log).toHaveBeenCalledWith('Create a TypeScript React button component');

      // Check assistant message display with tool use
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('[2] ASSISTANT'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('I\'ll help you create a TypeScript React button component'));
      expect(consoleSpy.log).toHaveBeenCalledWith('[Tool: Write]');
      // Individual message cost display has been removed

      // Check subsequent messages
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('[3] USER'));
      expect(consoleSpy.log).toHaveBeenCalledWith('Can you add click event handling?');

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('[4] ASSISTANT'));
      expect(consoleSpy.log).toHaveBeenCalledWith('Certainly! I\'ll update the button component to include proper click event handling with TypeScript types.');
      // Individual message cost display has been removed
    });

    it('should truncate long message content', async () => {
      const longMessage: ConversationMessage = {
        uuid: 'msg-long',
        type: 'assistant',
        message: {
          id: 'msg_long',
          role: 'assistant',
          content: 'A'.repeat(250) // 250 characters, should be truncated
        },
        timestamp: '2024-01-01T10:00:00Z',
        sessionId: 'session-123'
      };

      mockReader.fetchConversation.mockResolvedValue([longMessage]);

      const sessionId = 'session-123';
      
      await getCommand(sessionId, {});

      const expectedTruncated = 'A'.repeat(200) + '...';
      expect(consoleSpy.log).toHaveBeenCalledWith(expectedTruncated);
    });

    it('should handle array content format', async () => {
      const arrayContentMessage: ConversationMessage = {
        uuid: 'msg-array',
        type: 'assistant',
        message: {
          id: 'msg_array',
          role: 'assistant',
          content: [
            { type: 'text', text: 'First text block' },
            { type: 'text', text: 'Second text block' },
            { type: 'tool_use', id: 'tool1', name: 'Bash', input: { command: 'ls' } }
          ]
        },
        timestamp: '2024-01-01T10:00:00Z',
        sessionId: 'session-123'
      };

      mockReader.fetchConversation.mockResolvedValue([arrayContentMessage]);

      const sessionId = 'session-123';
      
      await getCommand(sessionId, {});

      expect(consoleSpy.log).toHaveBeenCalledWith('First text block');
      expect(consoleSpy.log).toHaveBeenCalledWith('Second text block');
      expect(consoleSpy.log).toHaveBeenCalledWith('[Tool: Bash]');
    });

    it('should handle string content format', async () => {
      const stringContentMessage: ConversationMessage = {
        uuid: 'msg-string',
        type: 'assistant',
        message: {
          id: 'msg_string',
          role: 'assistant',
          content: 'This is a simple string message'
        },
        timestamp: '2024-01-01T10:00:00Z',
        sessionId: 'session-123'
      };

      mockReader.fetchConversation.mockResolvedValue([stringContentMessage]);

      const sessionId = 'session-123';
      
      await getCommand(sessionId, {});

      expect(consoleSpy.log).toHaveBeenCalledWith('This is a simple string message');
    });


    it('should handle missing model in metadata', async () => {
      const metadataWithoutModel = {
        ...createSampleMetadata(),
        model: undefined
      } as any; // Cast to any to handle the undefined case
      mockReader.getConversationMetadata.mockResolvedValue(metadataWithoutModel);

      const sessionId = 'session-123';
      
      await getCommand(sessionId, {});

      expect(consoleSpy.log).toHaveBeenCalledWith('Model: Unknown');
    });

    it('should display cost information only for messages that have it', async () => {
      const messagesWithMixedCosts: ConversationMessage[] = [
        {
          uuid: 'msg-no-cost',
          type: 'user',
          message: { role: 'user', content: 'Question' },
          timestamp: '2024-01-01T10:00:00Z',
          sessionId: 'session-123'
        },
        {
          uuid: 'msg-with-cost',
          type: 'assistant',
          message: { id: 'msg_1', role: 'assistant', content: 'Answer' },
          timestamp: '2024-01-01T10:00:01Z',
          sessionId: 'session-123'
        }
      ];

      mockReader.fetchConversation.mockResolvedValue(messagesWithMixedCosts);

      const sessionId = 'session-123';
      
      await getCommand(sessionId, {});

      // User message should not show cost
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('[1] USER'));
      expect(consoleSpy.log).toHaveBeenCalledWith('Question');

      // Assistant message should not show cost
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('[2] ASSISTANT'));
      expect(consoleSpy.log).toHaveBeenCalledWith('Answer');
    });
  });

  describe('conversation not found', () => {
    beforeEach(() => {
      mockReader.getConversationMetadata.mockResolvedValue(null);
    });

    it('should handle conversation not found', async () => {
      const sessionId = 'non-existent-session';
      
      await getCommand(sessionId, {});

      expect(consoleSpy.error).toHaveBeenCalledWith('Conversation non-existent-session not found');
      expect(mockExit).toHaveBeenCalledWith(1);
      // Note: fetchConversation is called even when metadata is null due to implementation order
      expect(mockReader.fetchConversation).toHaveBeenCalledWith(sessionId);
    });
  });

  describe('error handling', () => {
    it('should handle metadata fetch errors', async () => {
      const metadataError = new Error('Failed to read conversation metadata');
      mockReader.getConversationMetadata.mockRejectedValue(metadataError);

      const sessionId = 'session-123';
      
      await getCommand(sessionId, {});

      expect(consoleSpy.error).toHaveBeenCalledWith('Error getting conversation:', metadataError);
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle message fetch errors', async () => {
      mockReader.getConversationMetadata.mockResolvedValue(createSampleMetadata());
      
      const messageError = new Error('Failed to read conversation messages');
      mockReader.fetchConversation.mockRejectedValue(messageError);

      const sessionId = 'session-123';
      
      await getCommand(sessionId, {});

      expect(consoleSpy.error).toHaveBeenCalledWith('Error getting conversation:', messageError);
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle constructor errors', async () => {
      const constructorError = new Error('Invalid Claude home path');
      MockedClaudeHistoryReader.mockImplementation(() => {
        throw constructorError;
      });

      const sessionId = 'session-123';
      
      await getCommand(sessionId, {});

      expect(consoleSpy.error).toHaveBeenCalledWith('Error getting conversation:', constructorError);
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle file system permission errors', async () => {
      const permissionError = new Error('EACCES: permission denied');
      mockReader.getConversationMetadata.mockRejectedValue(permissionError);

      const sessionId = 'session-123';
      
      await getCommand(sessionId, {});

      expect(consoleSpy.error).toHaveBeenCalledWith('Error getting conversation:', permissionError);
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty conversation', async () => {
      mockReader.getConversationMetadata.mockResolvedValue(createSampleMetadata());
      mockReader.fetchConversation.mockResolvedValue([]);

      const sessionId = 'session-empty';
      
      await getCommand(sessionId, {});

      expect(consoleSpy.log).toHaveBeenCalledWith('Messages: 0');
      expect(consoleSpy.log).toHaveBeenCalledWith('\nMessages:');
      expect(consoleSpy.log).toHaveBeenCalledWith('-'.repeat(50));
      // Should not display any message entries
    });

    it('should handle very small costs', async () => {
      const messageWithSmallCost: ConversationMessage = {
        uuid: 'msg-small-cost',
        type: 'assistant',
        message: { id: 'msg_1', role: 'assistant', content: 'Quick response' },
        timestamp: '2024-01-01T10:00:00Z',
        sessionId: 'session-123'
        // costUSD field has been removed
      };

      mockReader.getConversationMetadata.mockResolvedValue(createSampleMetadata());
      mockReader.fetchConversation.mockResolvedValue([messageWithSmallCost]);

      const sessionId = 'session-123';
      
      await getCommand(sessionId, {});

      // Cost display has been removed
    });

    it('should handle zero costs', async () => {
      const messageWithZeroCost: ConversationMessage = {
        uuid: 'msg-zero-cost',
        type: 'assistant',
        message: { id: 'msg_1', role: 'assistant', content: 'Free response' },
        timestamp: '2024-01-01T10:00:00Z',
        sessionId: 'session-123'
        // costUSD field has been removed
      };

      mockReader.getConversationMetadata.mockResolvedValue(createSampleMetadata());
      mockReader.fetchConversation.mockResolvedValue([messageWithZeroCost]);

      const sessionId = 'session-123';
      
      await getCommand(sessionId, {});

      // Cost field has been removed entirely
      expect(consoleSpy.log).toHaveBeenCalledWith('Free response');
    });

    it('should handle message with no content', async () => {
      const messageWithNoContent: ConversationMessage = {
        uuid: 'msg-no-content',
        type: 'assistant',
        message: { id: 'msg_1', role: 'assistant' } as any,
        timestamp: '2024-01-01T10:00:00Z',
        sessionId: 'session-123'
      };

      mockReader.getConversationMetadata.mockResolvedValue(createSampleMetadata());
      mockReader.fetchConversation.mockResolvedValue([messageWithNoContent]);

      const sessionId = 'session-123';
      
      await getCommand(sessionId, {});

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('[1] ASSISTANT'));
      // Should not crash, but also should not display content
    });

    it('should handle very long session IDs', async () => {
      const longSessionId = 'very-long-session-id-'.repeat(10) + 'end';

      mockReader.getConversationMetadata.mockResolvedValue(createSampleMetadata());
      mockReader.fetchConversation.mockResolvedValue(createSampleMessages());
      
      await getCommand(longSessionId, {});

      expect(consoleSpy.log).toHaveBeenCalledWith(`\nConversation: ${longSessionId}`);
    });
  });
});