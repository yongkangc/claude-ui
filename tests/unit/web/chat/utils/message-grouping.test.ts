import { groupMessages, flattenMessages, countTotalMessages } from '@/web/chat/utils/message-grouping';
import type { ChatMessage } from '@/web/chat/types';

describe('groupMessages', () => {
  describe('basic functionality', () => {
    it('should return empty array for empty input', () => {
      expect(groupMessages([])).toEqual([]);
      expect(groupMessages(null as any)).toEqual([]);
      expect(groupMessages(undefined as any)).toEqual([]);
    });

    it('should return single message unchanged', () => {
      const message: ChatMessage = {
        id: '1',
        type: 'user',
        content: 'Hello',
        timestamp: '2023-01-01T00:00:00Z',
      };
      
      const result = groupMessages([message]);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ ...message, subMessages: undefined });
    });

    it('should handle multiple independent messages', () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          type: 'user',
          content: 'Hello',
          timestamp: '2023-01-01T00:00:00Z',
        },
        {
          id: '2',
          type: 'assistant',
          content: [{ type: 'text', text: 'Hi there!' }],
          timestamp: '2023-01-01T00:01:00Z',
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
    });
  });

  describe('Rule 1: parent_tool_use_id grouping', () => {
    it('should group messages with parent_tool_use_id under their parent tool call', () => {
      const messages: ChatMessage[] = [
        {
          id: 'assistant-1',
          type: 'assistant',
          content: [
            { type: 'text', text: 'I need to use a tool' },
            { type: 'tool_use', id: 'tool-123', name: 'test_tool', input: {} },
          ],
          timestamp: '2023-01-01T00:00:00Z',
        },
        {
          id: 'user-1',
          type: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tool-123', content: 'Tool result' }],
          timestamp: '2023-01-01T00:01:00Z',
          parent_tool_use_id: 'tool-123',
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('assistant-1');
      expect(result[0].subMessages).toHaveLength(1);
      expect(result[0].subMessages![0].id).toBe('user-1');
    });

    it('should handle child message appearing before parent (two-pass algorithm)', () => {
      const messages: ChatMessage[] = [
        {
          id: 'user-1',
          type: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tool-123', content: 'Tool result' }],
          timestamp: '2023-01-01T00:01:00Z',
          parent_tool_use_id: 'tool-123',
        },
        {
          id: 'assistant-1',
          type: 'assistant',
          content: [
            { type: 'text', text: 'I need to use a tool' },
            { type: 'tool_use', id: 'tool-123', name: 'test_tool', input: {} },
          ],
          timestamp: '2023-01-01T00:00:00Z',
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('assistant-1');
      expect(result[0].subMessages).toHaveLength(1);
      expect(result[0].subMessages![0].id).toBe('user-1');
    });

    it('should handle multiple children under same parent', () => {
      const messages: ChatMessage[] = [
        {
          id: 'assistant-1',
          type: 'assistant',
          content: [
            { type: 'tool_use', id: 'tool-123', name: 'test_tool', input: {} },
          ],
          timestamp: '2023-01-01T00:00:00Z',
        },
        {
          id: 'user-1',
          type: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tool-123', content: 'First result' }],
          timestamp: '2023-01-01T00:01:00Z',
          parent_tool_use_id: 'tool-123',
        },
        {
          id: 'user-2',
          type: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tool-123', content: 'Second result' }],
          timestamp: '2023-01-01T00:02:00Z',
          parent_tool_use_id: 'tool-123',
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('assistant-1');
      expect(result[0].subMessages).toHaveLength(2);
      expect(result[0].subMessages![0].id).toBe('user-1');
      expect(result[0].subMessages![1].id).toBe('user-2');
    });

    it('should handle orphan messages (parent not found)', () => {
      const messages: ChatMessage[] = [
        {
          id: 'user-1',
          type: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'nonexistent', content: 'Tool result' }],
          timestamp: '2023-01-01T00:01:00Z',
          parent_tool_use_id: 'nonexistent',
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('user-1');
      expect(result[0].subMessages).toBeUndefined();
    });
  });

  describe('Rule 2: tool_result content grouping', () => {
    it('should group user messages with tool_result content under nearest assistant', () => {
      const messages: ChatMessage[] = [
        {
          id: 'assistant-1',
          type: 'assistant',
          content: [{ type: 'text', text: 'I will use a tool' }],
          timestamp: '2023-01-01T00:00:00Z',
        },
        {
          id: 'user-1',
          type: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tool-123', content: 'Tool result' }],
          timestamp: '2023-01-01T00:01:00Z',
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('assistant-1');
      expect(result[0].subMessages).toHaveLength(1);
      expect(result[0].subMessages![0].id).toBe('user-1');
    });

    it('should handle tool_result as single content block', () => {
      const messages: ChatMessage[] = [
        {
          id: 'assistant-1',
          type: 'assistant',
          content: [{ type: 'text', text: 'I will use a tool' }],
          timestamp: '2023-01-01T00:00:00Z',
        },
        {
          id: 'user-1',
          type: 'user',
          content: { type: 'tool_result', tool_use_id: 'tool-123', content: 'Tool result' },
          timestamp: '2023-01-01T00:01:00Z',
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('assistant-1');
      expect(result[0].subMessages).toHaveLength(1);
      expect(result[0].subMessages![0].id).toBe('user-1');
    });

    it('should not group non-tool_result user messages', () => {
      const messages: ChatMessage[] = [
        {
          id: 'assistant-1',
          type: 'assistant',
          content: [{ type: 'text', text: 'Hello' }],
          timestamp: '2023-01-01T00:00:00Z',
        },
        {
          id: 'user-1',
          type: 'user',
          content: 'Regular user message',
          timestamp: '2023-01-01T00:01:00Z',
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('assistant-1');
      expect(result[1].id).toBe('user-1');
    });

    it('should handle no assistant available for tool_result', () => {
      const messages: ChatMessage[] = [
        {
          id: 'user-1',
          type: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tool-123', content: 'Tool result' }],
          timestamp: '2023-01-01T00:01:00Z',
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('user-1');
      expect(result[0].subMessages).toBeUndefined();
    });
  });

  describe('Complex scenarios', () => {
    it('should handle mixed grouping rules', () => {
      const messages: ChatMessage[] = [
        {
          id: 'assistant-1',
          type: 'assistant',
          content: [
            { type: 'text', text: 'I will use a tool' },
            { type: 'tool_use', id: 'tool-123', name: 'test_tool', input: {} },
          ],
          timestamp: '2023-01-01T00:00:00Z',
        },
        {
          id: 'user-1',
          type: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tool-123', content: 'Tool result' }],
          timestamp: '2023-01-01T00:01:00Z',
          parent_tool_use_id: 'tool-123',
        },
        {
          id: 'assistant-2',
          type: 'assistant',
          content: [{ type: 'text', text: 'Another response' }],
          timestamp: '2023-01-01T00:02:00Z',
        },
        {
          id: 'user-2',
          type: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tool-456', content: 'Another result' }],
          timestamp: '2023-01-01T00:03:00Z',
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(2);
      
      // First assistant with tool_use child
      expect(result[0].id).toBe('assistant-1');
      expect(result[0].subMessages).toHaveLength(1);
      expect(result[0].subMessages![0].id).toBe('user-1');
      
      // Second assistant with tool_result child
      expect(result[1].id).toBe('assistant-2');
      expect(result[1].subMessages).toHaveLength(1);
      expect(result[1].subMessages![0].id).toBe('user-2');
    });

    it('should preserve original message data when grouping', () => {
      const messages: ChatMessage[] = [
        {
          id: 'assistant-1',
          type: 'assistant',
          content: [{ type: 'tool_use', id: 'tool-123', name: 'test_tool', input: {} }],
          timestamp: '2023-01-01T00:00:00Z',
          isStreaming: false,
        },
        {
          id: 'user-1',
          type: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tool-123', content: 'Tool result' }],
          timestamp: '2023-01-01T00:01:00Z',
          parent_tool_use_id: 'tool-123',
        },
      ];
      
      const result = groupMessages(messages);
      expect(result[0].isStreaming).toBe(false);
      expect(result[0].subMessages![0].parent_tool_use_id).toBe('tool-123');
    });
  });

  describe('Edge cases', () => {
    it('should handle malformed content blocks gracefully', () => {
      const messages: ChatMessage[] = [
        {
          id: 'assistant-1',
          type: 'assistant',
          content: [null, undefined, { type: 'text', text: 'Hello' }],
          timestamp: '2023-01-01T00:00:00Z',
        },
        {
          id: 'user-1',
          type: 'user',
          content: [null, { type: 'tool_result', tool_use_id: 'tool-123', content: 'Result' }],
          timestamp: '2023-01-01T00:01:00Z',
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('assistant-1');
      expect(result[0].subMessages).toHaveLength(1);
      expect(result[0].subMessages![0].id).toBe('user-1');
    });

    it('should handle string content correctly', () => {
      const messages: ChatMessage[] = [
        {
          id: 'user-1',
          type: 'user',
          content: 'Just a string',
          timestamp: '2023-01-01T00:00:00Z',
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('user-1');
    });

    it('should reset subMessages to avoid stale data', () => {
      const messages: ChatMessage[] = [
        {
          id: 'user-1',
          type: 'user',
          content: 'Hello',
          timestamp: '2023-01-01T00:00:00Z',
          subMessages: [
            {
              id: 'stale-1',
              type: 'user',
              content: 'Stale message',
              timestamp: '2023-01-01T00:00:00Z',
            },
          ],
        },
      ];
      
      const result = groupMessages(messages);
      expect(result[0].subMessages).toBeUndefined();
    });
  });
});

describe('flattenMessages', () => {
  it('should flatten hierarchical messages to flat array', () => {
    const messages: ChatMessage[] = [
      {
        id: 'parent-1',
        type: 'assistant',
        content: [{ type: 'text', text: 'Parent' }],
        timestamp: '2023-01-01T00:00:00Z',
        subMessages: [
          {
            id: 'child-1',
            type: 'user',
            content: 'Child 1',
            timestamp: '2023-01-01T00:01:00Z',
          },
          {
            id: 'child-2',
            type: 'user',
            content: 'Child 2',
            timestamp: '2023-01-01T00:02:00Z',
          },
        ],
      },
      {
        id: 'parent-2',
        type: 'user',
        content: 'Another parent',
        timestamp: '2023-01-01T00:03:00Z',
      },
    ];
    
    const result = flattenMessages(messages);
    expect(result).toHaveLength(4);
    expect(result.map(m => m.id)).toEqual(['parent-1', 'child-1', 'child-2', 'parent-2']);
  });

  it('should handle empty arrays', () => {
    expect(flattenMessages([])).toEqual([]);
  });

  it('should handle nested sub-messages', () => {
    const messages: ChatMessage[] = [
      {
        id: 'parent-1',
        type: 'assistant',
        content: [{ type: 'text', text: 'Parent' }],
        timestamp: '2023-01-01T00:00:00Z',
        subMessages: [
          {
            id: 'child-1',
            type: 'user',
            content: 'Child 1',
            timestamp: '2023-01-01T00:01:00Z',
            subMessages: [
              {
                id: 'grandchild-1',
                type: 'user',
                content: 'Grandchild',
                timestamp: '2023-01-01T00:02:00Z',
              },
            ],
          },
        ],
      },
    ];
    
    const result = flattenMessages(messages);
    expect(result).toHaveLength(3);
    expect(result.map(m => m.id)).toEqual(['parent-1', 'child-1', 'grandchild-1']);
  });
});

describe('countTotalMessages', () => {
  it('should count messages including sub-messages', () => {
    const messages: ChatMessage[] = [
      {
        id: 'parent-1',
        type: 'assistant',
        content: [{ type: 'text', text: 'Parent' }],
        timestamp: '2023-01-01T00:00:00Z',
        subMessages: [
          {
            id: 'child-1',
            type: 'user',
            content: 'Child 1',
            timestamp: '2023-01-01T00:01:00Z',
          },
          {
            id: 'child-2',
            type: 'user',
            content: 'Child 2',
            timestamp: '2023-01-01T00:02:00Z',
          },
        ],
      },
      {
        id: 'parent-2',
        type: 'user',
        content: 'Another parent',
        timestamp: '2023-01-01T00:03:00Z',
      },
    ];
    
    const result = countTotalMessages(messages);
    expect(result).toBe(4);
  });

  it('should handle empty arrays', () => {
    expect(countTotalMessages([])).toBe(0);
  });

  it('should handle nested sub-messages', () => {
    const messages: ChatMessage[] = [
      {
        id: 'parent-1',
        type: 'assistant',
        content: [{ type: 'text', text: 'Parent' }],
        timestamp: '2023-01-01T00:00:00Z',
        subMessages: [
          {
            id: 'child-1',
            type: 'user',
            content: 'Child 1',
            timestamp: '2023-01-01T00:01:00Z',
            subMessages: [
              {
                id: 'grandchild-1',
                type: 'user',
                content: 'Grandchild',
                timestamp: '2023-01-01T00:02:00Z',
              },
            ],
          },
        ],
      },
    ];
    
    const result = countTotalMessages(messages);
    expect(result).toBe(3);
  });
});