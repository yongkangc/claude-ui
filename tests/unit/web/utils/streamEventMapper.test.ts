import { mapStreamEventToStatus, getConversationSummary, extractToolMetrics } from '@/web/chat/utils/streamEventMapper';
import type { StreamEvent } from '@/types';

describe('streamEventMapper', () => {
  describe('mapStreamEventToStatus', () => {
    it('should map connected event', () => {
      const event: StreamEvent = {
        type: 'connected',
        streaming_id: 'test-123',
        timestamp: new Date().toISOString(),
      };

      const result = mapStreamEventToStatus(event);

      expect(result.currentStatus).toBe('Connected');
      expect(result.connectionState).toBe('connected');
      expect(result.lastEvent).toEqual(event);
    });

    it('should map system init event', () => {
      const event: StreamEvent = {
        type: 'system',
        subtype: 'init',
        session_id: 'test-session',
        cwd: '/test/path',
        tools: ['Read', 'Write'],
        mcp_servers: [],
        model: 'claude-3-5-sonnet-20241022',
        permissionMode: 'default',
        apiKeySource: 'env',
      };

      const result = mapStreamEventToStatus(event);

      expect(result.currentStatus).toBe('Initializing...');
      expect(result.connectionState).toBe('connected');
    });

    it('should map assistant message without tools', () => {
      const event: StreamEvent = {
        type: 'assistant',
        session_id: 'test-session',
        message: {
          type: 'message',
          id: 'msg-123',
          role: 'assistant',
          model: 'claude-3-5-sonnet-20241022',
          content: [
            { type: 'text', text: 'Let me help you with that.', citations: null } as any,
          ],
          stop_reason: null,
          stop_sequence: null,
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
            server_tool_use: {
              web_search_requests: 0,
            },
            service_tier: 'standard',
          } as any,
        },
      };

      const result = mapStreamEventToStatus(event);

      expect(result.currentStatus).toBe('Thinking...');
      expect(result.currentTool).toBeUndefined();
      expect(result.messagePreview).toBe('Let me help you with that.');
    });

    it('should map assistant message with tool use', () => {
      const event: StreamEvent = {
        type: 'assistant',
        session_id: 'test-session',
        message: {
          type: 'message',
          id: 'msg-124',
          role: 'assistant',
          model: 'claude-3-5-sonnet-20241022',
          content: [
            { type: 'text', text: 'I\'ll read the file for you.', citations: null } as any,
            {
              type: 'tool_use',
              id: 'tool-123',
              name: 'Read',
              input: { file_path: '/test/file.txt' },
            },
          ],
          stop_reason: 'tool_use',
          stop_sequence: null,
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
            server_tool_use: {
              web_search_requests: 0,
            },
            service_tier: 'standard',
          } as any,
        },
      };

      const result = mapStreamEventToStatus(event);

      expect(result.currentStatus).toBe('Reading file...');
      expect(result.currentTool).toBe('Read');
      expect(result.messagePreview).toBe('I\'ll read the file for you.');
    });

    it('should map user message', () => {
      const event: StreamEvent = {
        type: 'user',
        session_id: 'test-session',
        message: {
          role: 'user',
          content: 'Please help me fix this bug',
        },
      };

      const result = mapStreamEventToStatus(event);

      expect(result.currentStatus).toBe('Processing input...');
      expect(result.currentTool).toBeUndefined();
    });

    it('should map result success event', () => {
      const event: StreamEvent = {
        type: 'result',
        subtype: 'success',
        session_id: 'test-session',
        is_error: false,
        duration_ms: 5000,
        duration_api_ms: 3000,
        num_turns: 3,
        usage: {
          input_tokens: 1000,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          output_tokens: 500,
          server_tool_use: {
            web_search_requests: 0,
          },
        },
      };

      const result = mapStreamEventToStatus(event);

      expect(result.currentStatus).toBe('Completed');
      expect(result.connectionState).toBe('disconnected');
    });

    it('should map result max turns event', () => {
      const event: StreamEvent = {
        type: 'result',
        subtype: 'error_max_turns',
        session_id: 'test-session',
        is_error: true,
        duration_ms: 10000,
        duration_api_ms: 8000,
        num_turns: 10,
        usage: {
          input_tokens: 5000,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          output_tokens: 2500,
          server_tool_use: {
            web_search_requests: 0,
          },
        },
      };

      const result = mapStreamEventToStatus(event);

      expect(result.currentStatus).toBe('Max turns reached');
      expect(result.connectionState).toBe('disconnected');
    });

    it('should truncate long message previews', () => {
      const longText = 'This is a very long message that should be truncated because it exceeds the maximum length allowed for message previews in the UI to ensure a clean display';
      
      const event: StreamEvent = {
        type: 'assistant',
        session_id: 'test-session',
        message: {
          type: 'message',
          id: 'msg-125',
          role: 'assistant',
          model: 'claude-3-5-sonnet-20241022',
          content: [
            { type: 'text', text: longText, citations: null } as any,
          ],
          stop_reason: null,
          stop_sequence: null,
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
            server_tool_use: {
              web_search_requests: 0,
            },
            service_tier: 'standard',
          } as any,
        },
      };

      const result = mapStreamEventToStatus(event);

      expect(result.messagePreview).toHaveLength(100);
      expect(result.messagePreview?.endsWith('...')).toBe(true);
    });
  });

  describe('getConversationSummary', () => {
    it('should return "No activity" for empty events', () => {
      expect(getConversationSummary([])).toBe('No activity');
    });

    it('should return completion message for successful result', () => {
      const events: StreamEvent[] = [
        {
          type: 'connected',
          streaming_id: 'test-123',
          timestamp: new Date().toISOString(),
        },
        {
          type: 'result',
          subtype: 'success',
          session_id: 'test-session',
          is_error: false,
          duration_ms: 5000,
          duration_api_ms: 3000,
          num_turns: 3,
          usage: {
            input_tokens: 1000,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
            output_tokens: 500,
            server_tool_use: {
              web_search_requests: 0,
            },
          },
        },
      ];

      expect(getConversationSummary(events)).toBe('Task completed successfully');
    });

    it('should return last tool action', () => {
      const events: StreamEvent[] = [
        {
          type: 'assistant',
          session_id: 'test-session',
          message: {
            type: 'message',
            id: 'msg-126',
            role: 'assistant',
            model: 'claude-3-5-sonnet-20241022',
            content: [
              {
                type: 'tool_use',
                id: 'tool-124',
                name: 'Write',
                input: { file_path: '/test/output.txt', content: 'Hello' },
              },
            ],
            stop_reason: 'tool_use',
            stop_sequence: null,
            usage: {
              input_tokens: 100,
              output_tokens: 50,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 0,
              server_tool_use: {
                web_search_requests: 0,
              },
              service_tier: 'standard',
            } as any,
          },
        },
      ];

      expect(getConversationSummary(events)).toBe('Last action: Write');
    });
  });

  describe('extractToolMetrics', () => {
    it('should count tool usage correctly', () => {
      const events: StreamEvent[] = [
        {
          type: 'assistant',
          session_id: 'test-session',
          message: {
            type: 'message',
            id: 'msg-127',
            role: 'assistant',
            model: 'claude-3-5-sonnet-20241022',
            content: [
              {
                type: 'tool_use',
                id: 'tool-125',
                name: 'Edit',
                input: { file_path: '/test/file.txt' },
              },
            ],
            stop_reason: 'tool_use',
            stop_sequence: null,
            usage: { 
              input_tokens: 100, 
              output_tokens: 50,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 0,
              server_tool_use: {
                web_search_requests: 0,
              },
              service_tier: 'standard',
            } as any,
          },
        },
        {
          type: 'assistant',
          session_id: 'test-session',
          message: {
            type: 'message',
            id: 'msg-128',
            role: 'assistant',
            model: 'claude-3-5-sonnet-20241022',
            content: [
              {
                type: 'tool_use',
                id: 'tool-126',
                name: 'Write',
                input: { file_path: '/test/new.txt', content: 'New file' },
              },
            ],
            stop_reason: 'tool_use',
            stop_sequence: null,
            usage: { 
              input_tokens: 100, 
              output_tokens: 50,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 0,
              server_tool_use: {
                web_search_requests: 0,
              },
              service_tier: 'standard',
            } as any,
          },
        },
        {
          type: 'assistant',
          session_id: 'test-session',
          message: {
            id: 'msg-129',
            role: 'assistant',
            model: 'claude-3-5-sonnet-20241022',
            content: [
              {
                type: 'tool_use',
                id: 'tool-127',
                name: 'MultiEdit',
                input: { file_path: '/test/file.txt', edits: [] },
              },
            ],
            stop_reason: 'tool_use',
            stop_sequence: null,
            usage: { 
              input_tokens: 100, 
              output_tokens: 50,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 0,
              server_tool_use: {
                web_search_requests: 0,
              },
              service_tier: 'standard',
            } as any,
          },
        },
      ];

      const metrics = extractToolMetrics(events);

      expect(metrics.editCount).toBe(2); // Edit + MultiEdit
      expect(metrics.writeCount).toBe(1); // Write
      expect(metrics.linesAdded).toBe(0); // Not implemented yet
      expect(metrics.linesRemoved).toBe(0); // Not implemented yet
    });
  });
});