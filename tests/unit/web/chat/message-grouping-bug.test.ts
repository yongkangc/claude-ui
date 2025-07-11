import { groupMessages } from '@/web/chat/utils/message-grouping';
import type { ChatMessage } from '@/web/chat/types';

describe('Message Grouping Bug - Tool Result Messages During Streaming', () => {
  it('should properly group tool_result user messages under their parent assistant messages', () => {
    const toolUseId = 'tool-use-789';
    
    // Simulate messages as they come from streaming
    const messages: ChatMessage[] = [
      // Assistant message with tool_use block
      {
        id: 'assistant-msg-1',
        type: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: toolUseId,
            name: 'read_file',
            input: { path: '/test/file.txt' },
          },
        ],
        timestamp: new Date().toISOString(),
        parent_tool_use_id: null,
      },
      // User message with tool_result - parent_tool_use_id is properly set by our fix
      {
        id: 'user-msg-1',
        type: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUseId,
            content: 'File content: Hello World',
          },
        ],
        timestamp: new Date().toISOString(),
        parent_tool_use_id: toolUseId, // This should be set by our fix in ConversationView
      },
    ];

    const grouped = groupMessages(messages);

    // Should have only 1 top-level message (the assistant)
    expect(grouped.length).toBe(1);
    expect(grouped[0].id).toBe('assistant-msg-1');
    
    // The user message should be a sub-message
    expect(grouped[0].subMessages).toBeDefined();
    expect(grouped[0].subMessages?.length).toBe(1);
    expect(grouped[0].subMessages?.[0].id).toBe('user-msg-1');
  });

  it('should handle the bug case where parent_tool_use_id is null', () => {
    const toolUseId = 'tool-use-789';
    
    // This simulates the bug where parent_tool_use_id is null
    const messages: ChatMessage[] = [
      {
        id: 'assistant-msg-1',
        type: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: toolUseId,
            name: 'read_file',
            input: { path: '/test/file.txt' },
          },
        ],
        timestamp: new Date().toISOString(),
        parent_tool_use_id: null,
      },
      {
        id: 'user-msg-1',
        type: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUseId,
            content: 'File content: Hello World',
          },
        ],
        timestamp: new Date().toISOString(),
        parent_tool_use_id: null, // Bug case: this is null instead of the tool_use_id
      },
    ];

    const grouped = groupMessages(messages);

    // With the bug, Rule 2 should still apply - tool_result messages go under nearest assistant
    expect(grouped.length).toBe(1);
    expect(grouped[0].id).toBe('assistant-msg-1');
    expect(grouped[0].subMessages?.length).toBe(1);
    expect(grouped[0].subMessages?.[0].id).toBe('user-msg-1');
  });

  it('should handle multiple tool uses and results in sequence', () => {
    const toolUseId1 = 'tool-use-001';
    const toolUseId2 = 'tool-use-002';
    
    const messages: ChatMessage[] = [
      {
        id: 'assistant-msg-2',
        type: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Let me check two files for you.',
          },
          {
            type: 'tool_use',
            id: toolUseId1,
            name: 'read_file',
            input: { path: '/test/file1.txt' },
          },
          {
            type: 'tool_use',
            id: toolUseId2,
            name: 'read_file',
            input: { path: '/test/file2.txt' },
          },
        ],
        timestamp: new Date().toISOString(),
        parent_tool_use_id: null,
      },
      {
        id: 'user-msg-1',
        type: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUseId1,
            content: 'File 1 content',
          },
        ],
        timestamp: new Date().toISOString(),
        parent_tool_use_id: toolUseId1, // Fixed by our implementation
      },
      {
        id: 'user-msg-2',
        type: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUseId2,
            content: 'File 2 content',
          },
        ],
        timestamp: new Date().toISOString(),
        parent_tool_use_id: toolUseId2, // Fixed by our implementation
      },
    ];

    const grouped = groupMessages(messages);

    // Should have 1 top-level message
    expect(grouped.length).toBe(1);
    expect(grouped[0].id).toBe('assistant-msg-2');
    
    // Should have 2 sub-messages
    expect(grouped[0].subMessages?.length).toBe(2);
    expect(grouped[0].subMessages?.[0].id).toBe('user-msg-1');
    expect(grouped[0].subMessages?.[1].id).toBe('user-msg-2');
  });

  it('should handle nested sub-messages correctly', () => {
    const toolUseId1 = 'tool-use-001';
    const toolUseId2 = 'tool-use-002';
    
    const messages: ChatMessage[] = [
      // First assistant with tool use
      {
        id: 'assistant-1',
        type: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: toolUseId1,
            name: 'search',
            input: { query: 'test' },
          },
        ],
        timestamp: new Date().toISOString(),
        parent_tool_use_id: null,
      },
      // Tool result that triggers another assistant response
      {
        id: 'user-1',
        type: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUseId1,
            content: 'Search results...',
          },
        ],
        timestamp: new Date().toISOString(),
        parent_tool_use_id: toolUseId1,
      },
      // Second assistant (nested) with another tool use
      {
        id: 'assistant-2',
        type: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Based on search, let me read a file.',
          },
          {
            type: 'tool_use',
            id: toolUseId2,
            name: 'read_file',
            input: { path: '/found/file.txt' },
          },
        ],
        timestamp: new Date().toISOString(),
        parent_tool_use_id: toolUseId1, // This assistant is nested under the first tool use
      },
      // Result for the second tool use
      {
        id: 'user-2',
        type: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUseId2,
            content: 'File contents...',
          },
        ],
        timestamp: new Date().toISOString(),
        parent_tool_use_id: toolUseId2,
      },
    ];

    const grouped = groupMessages(messages);

    // Should have 1 top-level message
    expect(grouped.length).toBe(1);
    expect(grouped[0].id).toBe('assistant-1');
    
    // First assistant should have 2 sub-messages (user-1 and assistant-2)
    expect(grouped[0].subMessages?.length).toBe(2);
    expect(grouped[0].subMessages?.[0].id).toBe('user-1');
    expect(grouped[0].subMessages?.[1].id).toBe('assistant-2');
    
    // The nested assistant-2 should have 1 sub-message (user-2)
    const nestedAssistant = grouped[0].subMessages?.[1];
    expect(nestedAssistant?.subMessages?.length).toBe(1);
    expect(nestedAssistant?.subMessages?.[0].id).toBe('user-2');
  });
});