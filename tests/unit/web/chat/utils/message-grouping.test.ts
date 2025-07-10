import { groupMessages, flattenMessages, countTotalMessages } from '@/web/chat/utils/message-grouping';
import type { ChatMessage } from '@/web/chat/types';

describe('message-grouping', () => {
  describe('groupMessages', () => {
    it('should handle empty array', () => {
      expect(groupMessages([])).toEqual([]);
    });

    it('should handle null/undefined input', () => {
      expect(groupMessages(null as any)).toEqual([]);
      expect(groupMessages(undefined as any)).toEqual([]);
    });

    it('should pass through messages without grouping rules', () => {
      const messages: ChatMessage[] = [
        { id: '1', type: 'user', content: 'Hello', timestamp: '2024-01-01' },
        { id: '2', type: 'assistant', content: 'Hi there', timestamp: '2024-01-01' },
      ];
      
      const result = groupMessages(messages);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
    });

    describe('Rule 1: parent_tool_use_id grouping', () => {
      it('should group messages with parent_tool_use_id under tool call messages', () => {
        const messages: ChatMessage[] = [
          {
            id: '1',
            type: 'assistant',
            content: [
              { type: 'text', text: 'Let me help' },
              { type: 'tool_use', id: 'tool-123', name: 'search' },
            ],
            timestamp: '2024-01-01',
          },
          {
            id: '2',
            type: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'tool-123' }],
            parent_tool_use_id: 'tool-123',
            timestamp: '2024-01-01',
          },
        ];

        const result = groupMessages(messages);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('1');
        expect(result[0].subMessages).toHaveLength(1);
        expect(result[0].subMessages![0].id).toBe('2');
      });

      it('should handle parent appearing before child in message order (one-pass constraint)', () => {
        const messages: ChatMessage[] = [
          {
            id: '1',
            type: 'assistant',
            content: [
              { type: 'tool_use', id: 'tool-123', name: 'search' },
            ],
            timestamp: '2024-01-01',
          },
          {
            id: '2',
            type: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'tool-123' }],
            parent_tool_use_id: 'tool-123',
            timestamp: '2024-01-01',
          },
        ];

        const result = groupMessages(messages);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('1');
        expect(result[0].subMessages).toHaveLength(1);
        expect(result[0].subMessages![0].id).toBe('2');
      });
    });

    describe('Rule 2: tool_result grouping', () => {
      it('should group user tool_result messages under nearest assistant', () => {
        const messages: ChatMessage[] = [
          { id: '1', type: 'user', content: 'Hello', timestamp: '2024-01-01' },
          { id: '2', type: 'assistant', content: 'Hi there', timestamp: '2024-01-01' },
          {
            id: '3',
            type: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'some-tool' }],
            timestamp: '2024-01-01',
          },
        ];

        const result = groupMessages(messages);
        expect(result).toHaveLength(2);
        expect(result[1].id).toBe('2');
        expect(result[1].subMessages).toHaveLength(1);
        expect(result[1].subMessages![0].id).toBe('3');
      });

      it('should handle tool_result with no previous assistant', () => {
        const messages: ChatMessage[] = [
          {
            id: '1',
            type: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'some-tool' }],
            timestamp: '2024-01-01',
          },
        ];

        const result = groupMessages(messages);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('1');
        expect(result[0].subMessages).toBeUndefined();
      });

      it('should handle streaming scenario where tool_result arrives during assistant streaming', () => {
        // This simulates the bug scenario where messages arrive in streaming order
        const messages: ChatMessage[] = [
          { id: '1', type: 'user', content: 'Hello', timestamp: '2024-01-01' },
          { id: '2', type: 'assistant', content: 'Starting to help...', timestamp: '2024-01-01' },
          {
            id: '3',
            type: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'tool-456' }],
            timestamp: '2024-01-01',
          },
          { id: '4', type: 'assistant', content: 'Based on the result...', timestamp: '2024-01-01' },
        ];

        const result = groupMessages(messages);
        expect(result).toHaveLength(3); // user, assistant (with tool_result), assistant
        expect(result[0].id).toBe('1');
        expect(result[1].id).toBe('2');
        expect(result[1].subMessages).toHaveLength(1);
        expect(result[1].subMessages![0].id).toBe('3');
        expect(result[2].id).toBe('4');
      });

      it('should handle multiple tool_results finding correct parent during streaming', () => {
        const messages: ChatMessage[] = [
          { id: '1', type: 'assistant', content: 'First assistant', timestamp: '2024-01-01' },
          {
            id: '2',
            type: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'tool-1' }],
            timestamp: '2024-01-01',
          },
          { id: '3', type: 'assistant', content: 'Second assistant', timestamp: '2024-01-01' },
          {
            id: '4',
            type: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'tool-2' }],
            timestamp: '2024-01-01',
          },
        ];

        const result = groupMessages(messages);
        expect(result).toHaveLength(2);
        
        // First assistant should have first tool_result
        expect(result[0].id).toBe('1');
        expect(result[0].subMessages).toHaveLength(1);
        expect(result[0].subMessages![0].id).toBe('2');
        
        // Second assistant should have second tool_result
        expect(result[1].id).toBe('3');
        expect(result[1].subMessages).toHaveLength(1);
        expect(result[1].subMessages![0].id).toBe('4');
      });
    });

    describe('Complex scenarios', () => {
      it('should handle both rules together', () => {
        const messages: ChatMessage[] = [
          {
            id: '1',
            type: 'assistant',
            content: [
              { type: 'text', text: 'Using a tool' },
              { type: 'tool_use', id: 'tool-abc', name: 'search' },
            ],
            timestamp: '2024-01-01',
          },
          {
            id: '2',
            type: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'tool-abc' }],
            parent_tool_use_id: 'tool-abc',
            timestamp: '2024-01-01',
          },
          { id: '3', type: 'assistant', content: 'Another message', timestamp: '2024-01-01' },
          {
            id: '4',
            type: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'other-tool' }],
            timestamp: '2024-01-01',
          },
        ];

        const result = groupMessages(messages);
        expect(result).toHaveLength(2);
        
        // First assistant with Rule 1 sub-message
        expect(result[0].id).toBe('1');
        expect(result[0].subMessages).toHaveLength(1);
        expect(result[0].subMessages![0].id).toBe('2');
        
        // Second assistant with Rule 2 sub-message
        expect(result[1].id).toBe('3');
        expect(result[1].subMessages).toHaveLength(1);
        expect(result[1].subMessages![0].id).toBe('4');
      });

      it('should reset subMessages on each grouping', () => {
        const messages: ChatMessage[] = [
          {
            id: '1',
            type: 'assistant',
            content: 'Message',
            timestamp: '2024-01-01',
            subMessages: [{ id: 'old', type: 'user', content: 'old', timestamp: '2024-01-01' }],
          },
        ];

        const result = groupMessages(messages);
        expect(result[0].subMessages).toBeUndefined();
      });
    });

    describe('Nested grouping scenarios', () => {
      it('should handle messages that are both parent and child', () => {
        const messages: ChatMessage[] = [
          {
            id: '1',
            type: 'assistant',
            content: [{ type: 'tool_use', id: 'tool-parent', name: 'parent_tool' }],
            timestamp: '2024-01-01',
          },
          {
            id: '2',
            type: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'tool-parent' }],
            parent_tool_use_id: 'tool-parent',
            timestamp: '2024-01-01',
          },
          {
            id: '3',
            type: 'assistant',
            content: [{ type: 'tool_use', id: 'tool-child', name: 'child_tool' }],
            parent_tool_use_id: 'tool-parent',
            timestamp: '2024-01-01',
          },
          {
            id: '4',
            type: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'tool-child' }],
            parent_tool_use_id: 'tool-child',
            timestamp: '2024-01-01',
          },
        ];

        const result = groupMessages(messages);
        expect(result).toHaveLength(1);
        
        // Top-level message
        expect(result[0].id).toBe('1');
        expect(result[0].subMessages).toHaveLength(2);
        
        // First sub-message (tool_result)
        expect(result[0].subMessages![0].id).toBe('2');
        
        // Second sub-message (assistant that also has children)
        expect(result[0].subMessages![1].id).toBe('3');
        expect(result[0].subMessages![1].subMessages).toHaveLength(1);
        expect(result[0].subMessages![1].subMessages![0].id).toBe('4');
      });

      it('should handle multiple levels of nesting', () => {
        const messages: ChatMessage[] = [
          {
            id: '1',
            type: 'assistant',
            content: [{ type: 'tool_use', id: 'tool-level1', name: 'level1' }],
            timestamp: '2024-01-01',
          },
          {
            id: '2',
            type: 'assistant',
            content: [{ type: 'tool_use', id: 'tool-level2', name: 'level2' }],
            parent_tool_use_id: 'tool-level1',
            timestamp: '2024-01-01',
          },
          {
            id: '3',
            type: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'tool-level2' }],
            parent_tool_use_id: 'tool-level2',
            timestamp: '2024-01-01',
          },
          {
            id: '4',
            type: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'tool-level1' }],
            parent_tool_use_id: 'tool-level1',
            timestamp: '2024-01-01',
          },
        ];

        const result = groupMessages(messages);
        expect(result).toHaveLength(1);
        
        // Top-level message
        expect(result[0].id).toBe('1');
        expect(result[0].subMessages).toHaveLength(2);
        
        // First sub-message (assistant with its own children)
        expect(result[0].subMessages![0].id).toBe('2');
        expect(result[0].subMessages![0].subMessages).toHaveLength(1);
        expect(result[0].subMessages![0].subMessages![0].id).toBe('3');
        
        // Second sub-message (tool_result for level1)
        expect(result[0].subMessages![1].id).toBe('4');
      });

      it('should handle streaming scenario with incremental message additions', () => {
        // Simulate messages arriving in streaming order
        const messages: ChatMessage[] = [
          { id: '1', type: 'user', content: 'Initial question', timestamp: '2024-01-01' },
          {
            id: '2',
            type: 'assistant',
            content: [{ type: 'tool_use', id: 'tool-stream1', name: 'search' }],
            timestamp: '2024-01-01',
          },
          {
            id: '3',
            type: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'tool-stream1' }],
            parent_tool_use_id: 'tool-stream1',
            timestamp: '2024-01-01',
          },
          {
            id: '4',
            type: 'assistant',
            content: [{ type: 'tool_use', id: 'tool-stream2', name: 'analyze' }],
            parent_tool_use_id: 'tool-stream1',
            timestamp: '2024-01-01',
          },
          {
            id: '5',
            type: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'tool-stream2' }],
            parent_tool_use_id: 'tool-stream2',
            timestamp: '2024-01-01',
          },
          { id: '6', type: 'assistant', content: 'Final response', timestamp: '2024-01-01' },
        ];

        const result = groupMessages(messages);
        expect(result).toHaveLength(3);
        
        // First user message
        expect(result[0].id).toBe('1');
        
        // Assistant with nested structure
        expect(result[1].id).toBe('2');
        expect(result[1].subMessages).toHaveLength(2);
        expect(result[1].subMessages![0].id).toBe('3'); // tool_result
        expect(result[1].subMessages![1].id).toBe('4'); // nested assistant
        expect(result[1].subMessages![1].subMessages).toHaveLength(1);
        expect(result[1].subMessages![1].subMessages![0].id).toBe('5'); // nested tool_result
        
        // Final assistant response
        expect(result[2].id).toBe('6');
      });

      it('should handle Rule 1 taking precedence over Rule 2', () => {
        const messages: ChatMessage[] = [
          {
            id: '1',
            type: 'assistant',
            content: [{ type: 'tool_use', id: 'tool-priority', name: 'priority_tool' }],
            timestamp: '2024-01-01',
          },
          {
            id: '2',
            type: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'tool-priority' }],
            parent_tool_use_id: 'tool-priority', // Rule 1 should take precedence
            timestamp: '2024-01-01',
          },
        ];

        const result = groupMessages(messages);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('1');
        expect(result[0].subMessages).toHaveLength(1);
        expect(result[0].subMessages![0].id).toBe('2');
      });
    });

    describe('One-pass algorithm performance', () => {
      it('should maintain dictionary lookup efficiency', () => {
        // Create a large number of messages to test performance
        const messages: ChatMessage[] = [];
        
        // Add 100 assistant messages with tool_use
        for (let i = 0; i < 100; i++) {
          messages.push({
            id: `assistant-${i}`,
            type: 'assistant',
            content: [{ type: 'tool_use', id: `tool-${i}`, name: 'test_tool' }],
            timestamp: '2024-01-01',
          });
        }
        
        // Add 100 user messages with parent_tool_use_id
        for (let i = 0; i < 100; i++) {
          messages.push({
            id: `user-${i}`,
            type: 'user',
            content: [{ type: 'tool_result', tool_use_id: `tool-${i}` }],
            parent_tool_use_id: `tool-${i}`,
            timestamp: '2024-01-01',
          });
        }

        const startTime = performance.now();
        const result = groupMessages(messages);
        const endTime = performance.now();
        
        // Should complete quickly (under 100ms for 200 messages)
        expect(endTime - startTime).toBeLessThan(100);
        
        // Should have 100 grouped messages
        expect(result).toHaveLength(100);
        
        // Each should have exactly one sub-message
        result.forEach((message, index) => {
          expect(message.id).toBe(`assistant-${index}`);
          expect(message.subMessages).toHaveLength(1);
          expect(message.subMessages![0].id).toBe(`user-${index}`);
        });
      });
    });

    describe('Edge cases', () => {
      it('should handle messages with mixed content types', () => {
        const messages: ChatMessage[] = [
          { id: '1', type: 'assistant', content: 'Text message', timestamp: '2024-01-01' },
          {
            id: '2',
            type: 'user',
            content: { type: 'tool_result', tool_use_id: 'single-block' },
            timestamp: '2024-01-01',
          },
        ];

        const result = groupMessages(messages);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('1');
        expect(result[0].subMessages).toHaveLength(1);
        expect(result[0].subMessages![0].id).toBe('2');
      });

      it('should handle deep nesting prevention', () => {
        // Even if a tool_result has parent_tool_use_id, Rule 1 takes precedence
        const messages: ChatMessage[] = [
          {
            id: '1',
            type: 'assistant',
            content: [{ type: 'tool_use', id: 'tool-123', name: 'search' }],
            timestamp: '2024-01-01',
          },
          {
            id: '2',
            type: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'tool-123' }],
            parent_tool_use_id: 'tool-123',
            timestamp: '2024-01-01',
          },
        ];

        const result = groupMessages(messages);
        expect(result).toHaveLength(1);
        expect(result[0].subMessages).toHaveLength(1);
      });
    });
  });

  describe('flattenMessages', () => {
    it('should flatten nested message structure', () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          type: 'assistant',
          content: 'Parent',
          timestamp: '2024-01-01',
          subMessages: [
            { id: '2', type: 'user', content: 'Child 1', timestamp: '2024-01-01' },
            { id: '3', type: 'user', content: 'Child 2', timestamp: '2024-01-01' },
          ],
        },
        { id: '4', type: 'assistant', content: 'Another', timestamp: '2024-01-01' },
      ];

      const flattened = flattenMessages(messages);
      expect(flattened).toHaveLength(4);
      expect(flattened.map(m => m.id)).toEqual(['1', '2', '3', '4']);
    });

    it('should handle empty sub-messages', () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          type: 'assistant',
          content: 'Parent',
          timestamp: '2024-01-01',
          subMessages: [],
        },
      ];

      const flattened = flattenMessages(messages);
      expect(flattened).toHaveLength(1);
    });
  });

  describe('countTotalMessages', () => {
    it('should count all messages including sub-messages', () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          type: 'assistant',
          content: 'Parent 1',
          timestamp: '2024-01-01',
          subMessages: [
            { id: '2', type: 'user', content: 'Child 1', timestamp: '2024-01-01' },
            { id: '3', type: 'user', content: 'Child 2', timestamp: '2024-01-01' },
          ],
        },
        {
          id: '4',
          type: 'assistant',
          content: 'Parent 2',
          timestamp: '2024-01-01',
          subMessages: [
            { id: '5', type: 'user', content: 'Child 3', timestamp: '2024-01-01' },
          ],
        },
      ];

      expect(countTotalMessages(messages)).toBe(5);
    });

    it('should handle empty array', () => {
      expect(countTotalMessages([])).toBe(0);
    });
  });
});