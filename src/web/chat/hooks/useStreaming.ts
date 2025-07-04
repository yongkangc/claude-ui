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
  const optionsRef = useRef(options);
  
  // Keep options ref up to date
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const disconnect = useCallback(() => {
    if (readerRef.current) {
      readerRef.current.cancel().catch(() => {});
      readerRef.current = null;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setIsConnected((prev) => {
      if (prev) {
        optionsRef.current.onDisconnect?.();
      }
      return false;
    });
  }, []);

  const connect = useCallback(async () => {
    // Guard against multiple connections
    if (!streamingId || readerRef.current || abortControllerRef.current) {
      console.log('[useStreaming] Skipping connect:', { 
        streamingId, 
        hasReader: !!readerRef.current, 
        hasAbortController: !!abortControllerRef.current,
        isConnected 
      });
      return;
    }

    console.log('[useStreaming] Connecting to stream:', streamingId);

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
      console.log('[useStreaming] Stream connected successfully');
      optionsRef.current.onConnect?.();

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
              optionsRef.current.onMessage(event);
            } catch (err) {
              console.error('Failed to parse stream message:', line, err);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Stream error:', error);
        optionsRef.current.onError?.(error);
      }
    } finally {
      disconnect();
    }
  }, [streamingId, disconnect]);

  useEffect(() => {
    if (streamingId) {
      console.log('[useStreaming] Effect triggered - connecting to stream:', streamingId);
      connect();
    } else {
      console.log('[useStreaming] Effect triggered - no streamingId, disconnecting');
      disconnect();
    }

    return () => {
      console.log('[useStreaming] Cleanup - disconnecting from stream:', streamingId);
      disconnect();
    };
  }, [streamingId]); // Only depend on streamingId, not the callbacks

  return {
    isConnected,
    connect,
    disconnect,
  };
}