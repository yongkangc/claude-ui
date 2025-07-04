import { useEffect, useRef, useCallback, useState } from 'react';
import type { StreamEvent } from '../types';

interface UseStreamingOptions {
  onMessage: (event: StreamEvent) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useStreaming(
  streamingId: string | null,
  options: UseStreamingOptions
) {
  const [isConnected, setIsConnected] = useState(false);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const connect = useCallback(async () => {
    if (!streamingId || readerRef.current) return;

    try {
      abortControllerRef.current = new AbortController();
      
      const response = await fetch(`/api/stream/${streamingId}`, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Stream connection failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      readerRef.current = reader;
      setIsConnected(true);
      options.onConnect?.();

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const decoded = decoder.decode(value, { stream: true });
        buffer += decoded;
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              // Handle SSE format: remove "data: " prefix
              let jsonLine = line;
              if (line.startsWith('data: ')) {
                jsonLine = line.substring(6);
              }
              
              // Skip SSE comments (lines starting with :)
              if (line.startsWith(':')) {
                continue;
              }
              
              const event = JSON.parse(jsonLine) as StreamEvent;
              options.onMessage(event);
            } catch (err) {
              console.error('Failed to parse stream message:', line, err);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Stream error:', error);
        options.onError?.(error);
      }
    } finally {
      disconnect();
    }
  }, [streamingId, options]);

  const disconnect = useCallback(() => {
    if (readerRef.current) {
      readerRef.current.cancel().catch(() => {});
      readerRef.current = null;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (isConnected) {
      setIsConnected(false);
      options.onDisconnect?.();
    }
  }, [isConnected, options]);

  useEffect(() => {
    if (streamingId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [streamingId, connect, disconnect]);

  return {
    isConnected,
    connect,
    disconnect,
  };
}