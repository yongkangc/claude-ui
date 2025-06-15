import { listCommand } from '@/cli/commands/list';
import { ClaudeHistoryReader } from '@/services/claude-history-reader';
import { ConversationSummary } from '@/types';

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

describe('CLI List Command', () => {
  let mockReader: jest.Mocked<ClaudeHistoryReader>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock reader instance
    mockReader = {
      listConversations: jest.fn()
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

  const createSampleConversations = (): ConversationSummary[] => [
    {
      sessionId: 'session-1',
      projectPath: '/Users/test/project/web',
      summary: 'Build a React component',
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-01T10:30:00Z',
      messageCount: 5
    },
    {
      sessionId: 'session-2',
      projectPath: '/Users/test/project/api',
      summary: 'API development with Node.js',
      createdAt: '2024-01-02T14:00:00Z',
      updatedAt: '2024-01-02T15:30:00Z',
      messageCount: 8
    },
    {
      sessionId: 'session-3',
      projectPath: '/home/user/backend',
      summary: 'Database schema design',
      createdAt: '2024-01-03T09:00:00Z',
      updatedAt: '2024-01-03T11:00:00Z',
      messageCount: 12
    }
  ];

  describe('successful listing', () => {
    beforeEach(() => {
      const conversations = createSampleConversations();
      mockReader.listConversations.mockResolvedValue({
        conversations,
        total: conversations.length
      });
    });

    it('should display conversations in table format by default', async () => {
      const options = {
        limit: '10',
        offset: '0'
      };

      await listCommand(options);

      expect(mockReader.listConversations).toHaveBeenCalledWith({
        projectPath: undefined,
        limit: 10,
        offset: 0,
        sortBy: 'updated',
        order: 'desc'
      });

      expect(consoleSpy.log).toHaveBeenCalledWith('Found 3 conversations (showing 3):\n');
      expect(consoleSpy.log).toHaveBeenCalledWith('Session ID'.padEnd(36) + ' | ' + 'Project Path'.padEnd(40) + ' | ' + 'Messages'.padEnd(8) + ' | ' + 'Updated');
      expect(consoleSpy.log).toHaveBeenCalledWith('-'.repeat(36) + '-+-' + '-'.repeat(40) + '-+-' + '-'.repeat(8) + '-+-' + '-'.repeat(20));
      
      // Check that conversation rows are displayed
      expect(consoleSpy.log).toHaveBeenCalledWith(
        'session-1'.padEnd(36) + ' | ' + '/Users/test/project/web'.padEnd(40) + ' | ' + '5'.padEnd(8) + ' | ' + '1/1/2024'
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        'session-2'.padEnd(36) + ' | ' + '/Users/test/project/api'.padEnd(40) + ' | ' + '8'.padEnd(8) + ' | ' + '1/2/2024'
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        'session-3'.padEnd(36) + ' | ' + '/home/user/backend'.padEnd(40) + ' | ' + '12'.padEnd(8) + ' | ' + '1/3/2024'
      );
    });

    it('should display conversations in JSON format when requested', async () => {
      const options = {
        limit: '10',
        offset: '0',
        json: true
      };

      const conversations = createSampleConversations();
      const expectedResult = {
        conversations,
        total: conversations.length
      };

      await listCommand(options);

      expect(consoleSpy.log).toHaveBeenCalledWith(JSON.stringify(expectedResult, null, 2));
      expect(consoleSpy.log).not.toHaveBeenCalledWith('Found 3 conversations (showing 3):\n');
    });

    it('should filter by project path when provided', async () => {
      const options = {
        project: '/Users/test/project',
        limit: '5',
        offset: '2'
      };

      await listCommand(options);

      expect(mockReader.listConversations).toHaveBeenCalledWith({
        projectPath: '/Users/test/project',
        limit: 5,
        offset: 2,
        sortBy: 'updated',
        order: 'desc'
      });
    });

    it('should handle long project paths by truncating', async () => {
      const longPathConversation: ConversationSummary = {
        sessionId: 'session-long',
        projectPath: '/very/long/path/that/exceeds/forty/characters/and/should/be/truncated',
        summary: 'Long path test',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:30:00Z',
        messageCount: 3
      };

      mockReader.listConversations.mockResolvedValue({
        conversations: [longPathConversation],
        total: 1
      });

      const options = {
        limit: '10',
        offset: '0'
      };

      await listCommand(options);

      const truncatedPath = '/very/long/path/that/exceeds/forty/chara';
      expect(consoleSpy.log).toHaveBeenCalledWith(
        'session-long'.padEnd(36) + ' | ' + truncatedPath.padEnd(40) + ' | ' + '3'.padEnd(8) + ' | ' + '1/1/2024'
      );
    });

    it('should show pagination info when total exceeds displayed count', async () => {
      const conversations = createSampleConversations();
      mockReader.listConversations.mockResolvedValue({
        conversations: [conversations[0], conversations[1]], // Only showing 2 of 3
        total: 10 // But total is 10
      });

      const options = {
        limit: '2',
        offset: '3'
      };

      await listCommand(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('\nShowing 4-5 of 10 conversations');
    });

    it('should handle empty project path gracefully', async () => {
      const conversationWithEmptyPath: ConversationSummary = {
        sessionId: 'session-empty-path',
        projectPath: '',
        summary: 'Empty path test',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:30:00Z',
        messageCount: 1
      };

      mockReader.listConversations.mockResolvedValue({
        conversations: [conversationWithEmptyPath],
        total: 1
      });

      const options = {
        limit: '10',
        offset: '0'
      };

      await listCommand(options);

      expect(consoleSpy.log).toHaveBeenCalledWith(
        'session-empty-path'.padEnd(36) + ' | ' + ''.padEnd(40) + ' | ' + '1'.padEnd(8) + ' | ' + '1/1/2024'
      );
    });
  });

  describe('empty results', () => {
    beforeEach(() => {
      mockReader.listConversations.mockResolvedValue({
        conversations: [],
        total: 0
      });
    });

    it('should display "No conversations found" message when empty', async () => {
      const options = {
        limit: '10',
        offset: '0'
      };

      await listCommand(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Found 0 conversations (showing 0):\n');
      expect(consoleSpy.log).toHaveBeenCalledWith('No conversations found.');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('Session ID'.padEnd(36) + ' | ' + 'Project Path'.padEnd(40) + ' | ' + 'Messages'.padEnd(8) + ' | ' + 'Updated');
    });

    it('should return empty JSON when no conversations found', async () => {
      const options = {
        limit: '10',
        offset: '0',
        json: true
      };

      const expectedResult = {
        conversations: [],
        total: 0
      };

      await listCommand(options);

      expect(consoleSpy.log).toHaveBeenCalledWith(JSON.stringify(expectedResult, null, 2));
    });
  });

  describe('error handling', () => {
    it('should handle ClaudeHistoryReader errors', async () => {
      const readerError = new Error('Failed to read conversation history');
      mockReader.listConversations.mockRejectedValue(readerError);

      const options = {
        limit: '10',
        offset: '0'
      };

      await listCommand(options);

      expect(consoleSpy.error).toHaveBeenCalledWith('Error listing conversations:', readerError);
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle file system permission errors', async () => {
      const permissionError = new Error('EACCES: permission denied');
      mockReader.listConversations.mockRejectedValue(permissionError);

      const options = {
        limit: '5',
        offset: '0'
      };

      await listCommand(options);

      expect(consoleSpy.error).toHaveBeenCalledWith('Error listing conversations:', permissionError);
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle unexpected errors in constructor', async () => {
      const constructorError = new Error('Invalid Claude home path');
      MockedClaudeHistoryReader.mockImplementation(() => {
        throw constructorError;
      });

      const options = {
        limit: '10',
        offset: '0'
      };

      await listCommand(options);

      expect(consoleSpy.error).toHaveBeenCalledWith('Error listing conversations:', constructorError);
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('parameter parsing', () => {
    it('should correctly parse string limit and offset to numbers', async () => {
      mockReader.listConversations.mockResolvedValue({
        conversations: [],
        total: 0
      });

      const options = {
        limit: '25',
        offset: '50'
      };

      await listCommand(options);

      expect(mockReader.listConversations).toHaveBeenCalledWith({
        projectPath: undefined,
        limit: 25,
        offset: 50,
        sortBy: 'updated',
        order: 'desc'
      });
    });

    it('should handle invalid numeric parameters', async () => {
      mockReader.listConversations.mockResolvedValue({
        conversations: [],
        total: 0
      });

      const options = {
        limit: 'invalid-number',
        offset: 'also-invalid'
      };

      await listCommand(options);

      // parseInt('invalid-number') returns NaN
      expect(mockReader.listConversations).toHaveBeenCalledWith({
        projectPath: undefined,
        limit: NaN,
        offset: NaN,
        sortBy: 'updated',
        order: 'desc'
      });
    });

    it('should handle numeric strings with whitespace', async () => {
      mockReader.listConversations.mockResolvedValue({
        conversations: [],
        total: 0
      });

      const options = {
        limit: '  15  ',
        offset: '  30  '
      };

      await listCommand(options);

      expect(mockReader.listConversations).toHaveBeenCalledWith({
        projectPath: undefined,
        limit: 15,
        offset: 30,
        sortBy: 'updated',
        order: 'desc'
      });
    });
  });

  describe('edge cases', () => {
    it('should handle very large message counts', async () => {
      const conversationWithLargeCount: ConversationSummary = {
        sessionId: 'session-large',
        projectPath: '/test/path',
        summary: 'Large message count',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:30:00Z',
        messageCount: 9999
      };

      mockReader.listConversations.mockResolvedValue({
        conversations: [conversationWithLargeCount],
        total: 1
      });

      const options = {
        limit: '10',
        offset: '0'
      };

      await listCommand(options);

      expect(consoleSpy.log).toHaveBeenCalledWith(
        'session-large'.padEnd(36) + ' | ' + '/test/path'.padEnd(40) + ' | ' + '9999'.padEnd(8) + ' | ' + '1/1/2024'
      );
    });

    it('should handle pagination edge case where offset + limit equals total', async () => {
      const conversations = createSampleConversations();
      mockReader.listConversations.mockResolvedValue({
        conversations: [conversations[2]], // Last conversation
        total: 3
      });

      const options = {
        limit: '1',
        offset: '2' // Should show conversation 3 of 3
      };

      await listCommand(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('\nShowing 3-3 of 3 conversations');
    });

    it('should handle date formatting edge cases', async () => {
      const conversationWithOddDate: ConversationSummary = {
        sessionId: 'session-date',
        projectPath: '/test/path',
        summary: 'Date formatting test',
        createdAt: '2024-12-31T23:59:59Z',
        updatedAt: '2024-12-31T23:59:59Z',
        messageCount: 1
      };

      mockReader.listConversations.mockResolvedValue({
        conversations: [conversationWithOddDate],
        total: 1
      });

      const options = {
        limit: '10',
        offset: '0'
      };

      await listCommand(options);

      // Should format the date correctly regardless of timezone
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('session-date')
      );
    });
  });
});