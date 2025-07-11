import { groupMessages } from '@/web/chat/utils/message-grouping';
import type { ChatMessage } from '@/web/chat/types';

describe('groupMessages', () => {
  describe('Basic functionality', () => {
    it('should return empty array for empty input', () => {
      expect(groupMessages([])).toEqual([]);
    });

    it('should return same array for messages without grouping rules', () => {
      const messages: ChatMessage[] = [
        { id: '1', type: 'user', content: 'Hello', timestamp: '2024-01-01T00:00:00Z' },
        { id: '2', type: 'assistant', content: 'Hi there', timestamp: '2024-01-01T00:00:01Z' },
        { id: '3', type: 'user', content: 'How are you?', timestamp: '2024-01-01T00:00:02Z' },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(3);
      expect(result.map(m => m.id)).toEqual(['1', '2', '3']);
    });
  });

  describe('Rule 1: parent_tool_use_id grouping', () => {
    it('should group message with parent_tool_use_id under parent tool call', () => {
      const messages: ChatMessage[] = [
        { 
          id: '1', 
          type: 'assistant', 
          content: [
            { type: 'text', text: 'Let me help' },
            { type: 'tool_use', id: 'tool_123', name: 'get_weather', input: {} }
          ],
          timestamp: '2024-01-01T00:00:00Z'
        },
        { 
          id: '2', 
          type: 'user', 
          content: [{ type: 'tool_result', tool_use_id: 'tool_123', content: 'Sunny' }],
          timestamp: '2024-01-01T00:00:01Z',
          parent_tool_use_id: 'tool_123'
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
      expect(result[0].subMessages).toHaveLength(1);
      expect(result[0].subMessages![0].id).toBe('2');
    });

    it('should handle multiple tool calls and results', () => {
      const messages: ChatMessage[] = [
        { 
          id: '1', 
          type: 'assistant', 
          content: [
            { type: 'tool_use', id: 'tool_1', name: 'tool1', input: {} },
            { type: 'tool_use', id: 'tool_2', name: 'tool2', input: {} }
          ],
          timestamp: '2024-01-01T00:00:00Z'
        },
        { 
          id: '2', 
          type: 'user', 
          content: [{ type: 'tool_result', tool_use_id: 'tool_1', content: 'Result 1' }],
          timestamp: '2024-01-01T00:00:01Z',
          parent_tool_use_id: 'tool_1'
        },
        { 
          id: '3', 
          type: 'user', 
          content: [{ type: 'tool_result', tool_use_id: 'tool_2', content: 'Result 2' }],
          timestamp: '2024-01-01T00:00:02Z',
          parent_tool_use_id: 'tool_2'
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(1);
      expect(result[0].subMessages).toHaveLength(2);
      expect(result[0].subMessages!.map(m => m.id)).toEqual(['2', '3']);
    });
  });

  describe('Rule 2: tool_result grouping under latest assistant', () => {
    it('should group tool_result messages without parent_tool_use_id under latest assistant', () => {
      const messages: ChatMessage[] = [
        { id: '1', type: 'user', content: 'Hello', timestamp: '2024-01-01T00:00:00Z' },
        { id: '2', type: 'assistant', content: 'Let me help', timestamp: '2024-01-01T00:00:01Z' },
        { 
          id: '3', 
          type: 'user', 
          content: [{ type: 'tool_result', tool_use_id: 'some_tool', content: 'Result' }],
          timestamp: '2024-01-01T00:00:02Z'
          // Note: no parent_tool_use_id
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(2); // user and assistant
      expect(result[1].id).toBe('2');
      expect(result[1].subMessages).toHaveLength(1);
      expect(result[1].subMessages![0].id).toBe('3');
    });

    it('should handle multiple tool_results grouped under same assistant', () => {
      const messages: ChatMessage[] = [
        { id: '1', type: 'assistant', content: 'Processing', timestamp: '2024-01-01T00:00:00Z' },
        { 
          id: '2', 
          type: 'user', 
          content: [{ type: 'tool_result', tool_use_id: 'tool1', content: 'Result1' }],
          timestamp: '2024-01-01T00:00:01Z'
        },
        { 
          id: '3', 
          type: 'user', 
          content: [{ type: 'tool_result', tool_use_id: 'tool2', content: 'Result2' }],
          timestamp: '2024-01-01T00:00:02Z'
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(1);
      expect(result[0].subMessages).toHaveLength(2);
      expect(result[0].subMessages!.map(m => m.id)).toEqual(['2', '3']);
    });

    it('should update latest assistant when new assistant message arrives', () => {
      const messages: ChatMessage[] = [
        { id: '1', type: 'assistant', content: 'First assistant', timestamp: '2024-01-01T00:00:00Z' },
        { 
          id: '2', 
          type: 'user', 
          content: [{ type: 'tool_result', tool_use_id: 'tool1', content: 'Result1' }],
          timestamp: '2024-01-01T00:00:01Z'
        },
        { id: '3', type: 'assistant', content: 'Second assistant', timestamp: '2024-01-01T00:00:02Z' },
        { 
          id: '4', 
          type: 'user', 
          content: [{ type: 'tool_result', tool_use_id: 'tool2', content: 'Result2' }],
          timestamp: '2024-01-01T00:00:03Z'
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[0].subMessages).toHaveLength(1);
      expect(result[0].subMessages![0].id).toBe('2');
      expect(result[1].id).toBe('3');
      expect(result[1].subMessages).toHaveLength(1);
      expect(result[1].subMessages![0].id).toBe('4');
    });

    it('should not group tool_result if no assistant message exists', () => {
      const messages: ChatMessage[] = [
        { id: '1', type: 'user', content: 'Hello', timestamp: '2024-01-01T00:00:00Z' },
        { 
          id: '2', 
          type: 'user', 
          content: [{ type: 'tool_result', tool_use_id: 'tool1', content: 'Result' }],
          timestamp: '2024-01-01T00:00:01Z'
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(2);
      expect(result.map(m => m.id)).toEqual(['1', '2']);
    });
  });

  describe('Rule priority: tool_result always uses Rule 2', () => {
    it('should always group tool_result under latest assistant, ignoring parent_tool_use_id', () => {
      const messages: ChatMessage[] = [
        { 
          id: '1', 
          type: 'assistant', 
          content: [{ type: 'tool_use', id: 'tool_123', name: 'tool', input: {} }],
          timestamp: '2024-01-01T00:00:00Z'
        },
        { id: '2', type: 'assistant', content: 'Another assistant', timestamp: '2024-01-01T00:00:01Z' },
        { 
          id: '3', 
          type: 'user', 
          content: [{ type: 'tool_result', tool_use_id: 'tool_123', content: 'Result' }],
          timestamp: '2024-01-01T00:00:02Z',
          parent_tool_use_id: 'tool_123' // Should group under message 2 (latest assistant), not 1
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[0].subMessages).toBeUndefined(); // No sub-messages under first assistant
      expect(result[1].id).toBe('2');
      expect(result[1].subMessages).toHaveLength(1);
      expect(result[1].subMessages![0].id).toBe('3'); // tool_result grouped under latest assistant
    });
  });

  describe('Complex streaming scenarios', () => {
    it('should handle assistant → tool_result → assistant → tool_result pattern', () => {
      const messages: ChatMessage[] = [
        { id: '1', type: 'assistant', content: 'First task', timestamp: '2024-01-01T00:00:00Z' },
        { 
          id: '2', 
          type: 'user', 
          content: [{ type: 'tool_result', tool_use_id: 'tool1', content: 'Result1' }],
          timestamp: '2024-01-01T00:00:01Z'
        },
        { 
          id: '3', 
          type: 'user', 
          content: [{ type: 'tool_result', tool_use_id: 'tool2', content: 'Result2' }],
          timestamp: '2024-01-01T00:00:02Z'
        },
        { id: '4', type: 'assistant', content: 'Second task', timestamp: '2024-01-01T00:00:03Z' },
        { 
          id: '5', 
          type: 'user', 
          content: [{ type: 'tool_result', tool_use_id: 'tool3', content: 'Result3' }],
          timestamp: '2024-01-01T00:00:04Z'
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(2);
      
      // First assistant with its tool results
      expect(result[0].id).toBe('1');
      expect(result[0].subMessages).toHaveLength(2);
      expect(result[0].subMessages!.map(m => m.id)).toEqual(['2', '3']);
      
      // Second assistant with its tool result
      expect(result[1].id).toBe('4');
      expect(result[1].subMessages).toHaveLength(1);
      expect(result[1].subMessages![0].id).toBe('5');
    });

    it('should handle sequential tool_result messages correctly', () => {
      const messages: ChatMessage[] = [
        { 
          id: '1', 
          type: 'assistant', 
          content: [
            { type: 'text', text: 'Processing' },
            { type: 'tool_use', id: 'tool_parent', name: 'parent_tool', input: {} }
          ],
          timestamp: '2024-01-01T00:00:00Z'
        },
        { 
          id: '2', 
          type: 'user', 
          content: [{ type: 'tool_result', tool_use_id: 'tool_parent', content: 'Parent result' }],
          timestamp: '2024-01-01T00:00:01Z',
          parent_tool_use_id: 'tool_parent' // Will be ignored, groups under latest assistant (1)
        },
        { 
          id: '3', 
          type: 'assistant', 
          content: [
            { type: 'text', text: 'Nested processing' },
            { type: 'tool_use', id: 'tool_nested', name: 'nested_tool', input: {} }
          ],
          timestamp: '2024-01-01T00:00:02Z'
        },
        { 
          id: '4', 
          type: 'user', 
          content: [{ type: 'tool_result', tool_use_id: 'tool_nested', content: 'Nested result' }],
          timestamp: '2024-01-01T00:00:03Z',
          parent_tool_use_id: 'tool_nested' // Will be ignored, groups under latest assistant (3)
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(2);
      
      // First assistant with its tool_result
      expect(result[0].id).toBe('1');
      expect(result[0].subMessages).toHaveLength(1);
      expect(result[0].subMessages![0].id).toBe('2');
      
      // Second assistant with its tool_result
      expect(result[1].id).toBe('3');
      expect(result[1].subMessages).toHaveLength(1);
      expect(result[1].subMessages![0].id).toBe('4');
    });
  });

  describe('Content type variations', () => {
    it('should handle tool_result as single content object', () => {
      const messages: ChatMessage[] = [
        { id: '1', type: 'assistant', content: 'Helper', timestamp: '2024-01-01T00:00:00Z' },
        { 
          id: '2', 
          type: 'user', 
          content: { type: 'tool_result', tool_use_id: 'tool1', content: 'Result' } as any,
          timestamp: '2024-01-01T00:00:01Z'
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(1);
      expect(result[0].subMessages).toHaveLength(1);
      expect(result[0].subMessages![0].id).toBe('2');
    });

    it('should handle mixed content types in assistant messages', () => {
      const messages: ChatMessage[] = [
        { 
          id: '1', 
          type: 'assistant', 
          content: [
            { type: 'text', text: 'Starting' },
            { type: 'tool_use', id: 'tool1', name: 'tool', input: {} },
            { type: 'text', text: 'Continuing' },
            { type: 'tool_use', id: 'tool2', name: 'tool', input: {} }
          ],
          timestamp: '2024-01-01T00:00:00Z'
        },
        { 
          id: '2', 
          type: 'user', 
          content: [{ type: 'tool_result', tool_use_id: 'tool2', content: 'Result for tool2' }],
          timestamp: '2024-01-01T00:00:01Z',
          parent_tool_use_id: 'tool2' // Should still find tool2 even though it's not first
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(1);
      expect(result[0].subMessages).toHaveLength(1);
      expect(result[0].subMessages![0].id).toBe('2');
    });
  });

  describe('Edge cases', () => {
    it('should preserve subMessages=undefined for messages without children', () => {
      const messages: ChatMessage[] = [
        { id: '1', type: 'user', content: 'Hello', timestamp: '2024-01-01T00:00:00Z' },
        { id: '2', type: 'assistant', content: 'Hi', timestamp: '2024-01-01T00:00:01Z' },
      ];
      
      const result = groupMessages(messages);
      expect(result[0].subMessages).toBeUndefined();
      expect(result[1].subMessages).toBeUndefined();
    });

    it('should reset existing subMessages on regrouping', () => {
      const messages: ChatMessage[] = [
        { 
          id: '1', 
          type: 'assistant', 
          content: 'Helper', 
          timestamp: '2024-01-01T00:00:00Z',
          subMessages: [{ id: 'old', type: 'user', content: 'Should be removed', timestamp: '2024-01-01T00:00:00Z' }]
        },
        { 
          id: '2', 
          type: 'user', 
          content: [{ type: 'tool_result', tool_use_id: 'tool1', content: 'New result' }],
          timestamp: '2024-01-01T00:00:01Z'
        },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(1);
      expect(result[0].subMessages).toHaveLength(1);
      expect(result[0].subMessages![0].id).toBe('2');
      // Old sub-message should be gone
      expect(result[0].subMessages!.find(m => m.id === 'old')).toBeUndefined();
    });

    it('should handle parent_tool_use_id that does not exist', () => {
      const messages: ChatMessage[] = [
        { id: '1', type: 'assistant', content: 'Helper', timestamp: '2024-01-01T00:00:00Z' },
        { 
          id: '2', 
          type: 'user', 
          content: [{ type: 'tool_result', tool_use_id: 'nonexistent', content: 'Result' }],
          timestamp: '2024-01-01T00:00:01Z',
          parent_tool_use_id: 'nonexistent' // This tool_use_id doesn't exist
        },
      ];
      
      const result = groupMessages(messages);
      // Since parent_tool_use_id doesn't exist, it falls back to Rule 2 (group under latest assistant)
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
      expect(result[0].subMessages).toHaveLength(1);
      expect(result[0].subMessages![0].id).toBe('2');
    });
  });
});