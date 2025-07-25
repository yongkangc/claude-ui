import { renderHook, act, waitFor } from '@testing-library/react';
import { useMultipleStreams } from '@/web/chat/hooks/useMultipleStreams';
import type { StreamEvent } from '@/types';

// Mock fetch
global.fetch = jest.fn();

describe('useMultipleStreams', () => {
  let mockReader: any;
  let mockResponse: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock ReadableStreamDefaultReader
    mockReader = {
      read: jest.fn(),
      cancel: jest.fn().mockResolvedValue(undefined),
    };

    // Mock Response
    mockResponse = {
      ok: true,
      body: {
        getReader: jest.fn().mockReturnValue(mockReader),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should connect to multiple streams', async () => {
    const onStreamMessage = jest.fn();
    const onStreamConnect = jest.fn();
    const streamingIds = ['stream-1', 'stream-2'];

    // Mock successful reads
    mockReader.read
      .mockResolvedValueOnce({ 
        done: false, 
        value: new TextEncoder().encode('data: {"type":"connected","streaming_id":"stream-1","timestamp":"2024-01-01T00:00:00Z"}\n\n') 
      })
      .mockResolvedValueOnce({ done: true });

    const { result } = renderHook(() =>
      useMultipleStreams(streamingIds, {
        onStreamMessage,
        onStreamConnect,
      })
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/stream/stream-1', expect.any(Object));
      expect(fetch).toHaveBeenCalledWith('/api/stream/stream-2', expect.any(Object));
    });

    expect(result.current.activeConnectionCount).toBeLessThanOrEqual(5);
  });

  it('should respect max concurrent connections', async () => {
    const onStreamMessage = jest.fn();
    const streamingIds = Array.from({ length: 10 }, (_, i) => `stream-${i}`);

    // Mock pending connections
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() =>
      useMultipleStreams(streamingIds, {
        onStreamMessage,
        maxConcurrentConnections: 3,
      })
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Should only connect to max 3 streams
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result.current.activeConnectionCount).toBe(3);
  });

  it('should handle stream messages', async () => {
    const onStreamMessage = jest.fn();
    const onStreamConnect = jest.fn();
    const streamingIds = ['stream-1'];

    const event: StreamEvent = {
      type: 'connected',
      streaming_id: 'stream-1',
      timestamp: '2024-01-01T00:00:00Z',
    };

    mockReader.read
      .mockResolvedValueOnce({ 
        done: false, 
        value: new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`) 
      })
      .mockResolvedValueOnce({ done: true });

    renderHook(() =>
      useMultipleStreams(streamingIds, {
        onStreamMessage,
        onStreamConnect,
      })
    );

    await waitFor(() => {
      expect(onStreamMessage).toHaveBeenCalledWith('stream-1', event);
    });
  });

  it('should handle disconnection', async () => {
    const onStreamDisconnect = jest.fn();
    const streamingIds = ['stream-1'];

    mockReader.read.mockResolvedValueOnce({ done: true });

    const { result } = renderHook(() =>
      useMultipleStreams(streamingIds, {
        onStreamMessage: jest.fn(),
        onStreamDisconnect,
      })
    );

    await waitFor(() => {
      expect(onStreamDisconnect).toHaveBeenCalledWith('stream-1');
    });

    expect(result.current.connections.get('stream-1')?.connectionState).toBe('disconnected');
  });

  it('should retry on error with exponential backoff', async () => {
    jest.useFakeTimers();
    const onStreamError = jest.fn();
    const streamingIds = ['stream-1'];

    // First attempt fails
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockResponse);

    mockReader.read.mockResolvedValueOnce({ done: true });

    renderHook(() =>
      useMultipleStreams(streamingIds, {
        onStreamMessage: jest.fn(),
        onStreamError,
        maxRetries: 2,
        initialRetryDelay: 1000,
      })
    );

    // Wait for first error
    await waitFor(() => {
      expect(onStreamError).toHaveBeenCalledWith('stream-1', expect.any(Error));
    });

    // Fast forward to trigger retry
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('should handle stream removal', async () => {
    const onStreamDisconnect = jest.fn();
    
    const { rerender } = renderHook(
      ({ ids }) => useMultipleStreams(ids, {
        onStreamMessage: jest.fn(),
        onStreamDisconnect,
      }),
      {
        initialProps: { ids: ['stream-1', 'stream-2'] },
      }
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    // Remove one stream
    rerender({ ids: ['stream-1'] });

    await waitFor(() => {
      expect(onStreamDisconnect).toHaveBeenCalledWith('stream-2');
    });
  });

  it('should clean up on unmount', async () => {
    const onStreamDisconnect = jest.fn();
    const streamingIds = ['stream-1', 'stream-2'];

    const { unmount } = renderHook(() =>
      useMultipleStreams(streamingIds, {
        onStreamMessage: jest.fn(),
        onStreamDisconnect,
      })
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    unmount();

    await waitFor(() => {
      expect(onStreamDisconnect).toHaveBeenCalledWith('stream-1');
      expect(onStreamDisconnect).toHaveBeenCalledWith('stream-2');
      expect(mockReader.cancel).toHaveBeenCalled();
    });
  });

  it('should handle SSE comment lines', async () => {
    const onStreamMessage = jest.fn();
    const streamingIds = ['stream-1'];

    mockReader.read
      .mockResolvedValueOnce({ 
        done: false, 
        value: new TextEncoder().encode(': heartbeat\n\ndata: {"type":"connected","streaming_id":"stream-1","timestamp":"2024-01-01T00:00:00Z"}\n\n') 
      })
      .mockResolvedValueOnce({ done: true });

    renderHook(() =>
      useMultipleStreams(streamingIds, {
        onStreamMessage,
      })
    );

    await waitFor(() => {
      // Should only call onStreamMessage once (ignoring the heartbeat)
      expect(onStreamMessage).toHaveBeenCalledTimes(1);
      expect(onStreamMessage).toHaveBeenCalledWith('stream-1', expect.objectContaining({
        type: 'connected',
      }));
    });
  });
});