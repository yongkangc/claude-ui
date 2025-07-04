import React, { useState, useEffect, useRef } from 'react';

interface LogEntry {
  timestamp: string;
  level: string;
  component?: string;
  msg: string;
  [key: string]: any;
}

interface LogWindowProps {
  isVisible: boolean;
  onToggle: () => void;
}

function LogWindow({ isVisible, onToggle }: LogWindowProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  useEffect(() => {
    if (isVisible && !readerRef.current) {
      connectToLogStream();
    }

    return () => {
      if (readerRef.current) {
        readerRef.current.cancel();
        readerRef.current = null;
      }
    };
  }, [isVisible]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const connectToLogStream = async () => {
    try {
      // First get recent logs
      const recentResponse = await fetch('/api/logs/recent?limit=100');
      if (recentResponse.ok) {
        const recentData = await recentResponse.json();
        if (recentData.logs) {
          setLogs(recentData.logs);
        }
      }

      // Then connect to stream
      const response = await fetch('/api/logs/stream');
      if (!response.ok) {
        console.error('Failed to connect to log stream');
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      readerRef.current = reader;
      setIsConnected(true);

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            // Handle SSE format
            if (line.startsWith('data: ')) {
              const data = line.substring(6);
              setLogs(prev => [...prev, data]);
            }
          }
        }
      }
    } catch (error) {
      console.error('Log stream error:', error);
    } finally {
      setIsConnected(false);
      readerRef.current = null;
    }
  };

  const parseLogLine = (line: string): { formatted: JSX.Element; matchesFilter: boolean } => {
    // Check if line matches filter
    const matchesFilter = !filter || line.toLowerCase().includes(filter.toLowerCase());

    try {
      // Try to parse as JSON
      const parsed: LogEntry = JSON.parse(line);
      
      // Extract relevant fields, hide redundant ones
      const { level, time, component, msg, pid, hostname, requestId, ...rest } = parsed;
      
      // Format timestamp
      const timestamp = time ? new Date(time).toLocaleTimeString() : '';
      
      // Determine color based on log level
      const levelColors: Record<string, string> = {
        'debug': '#868e96',
        'info': '#51cf66',
        'warn': '#ffd43b',
        'error': '#ff6b6b',
        'fatal': '#ff0000'
      };
      const levelColor = levelColors[level] || '#d4d4d4';

      // Build compact display
      const formatted = (
        <div className="log-entry">
          <span className="log-time">{timestamp}</span>
          <span className="log-level" style={{ color: levelColor }}>[{level?.toUpperCase() || 'LOG'}]</span>
          {component && <span className="log-component">[{component}]</span>}
          <span className="log-message">{msg}</span>
          {requestId && <span className="log-extra"> (req: {requestId})</span>}
          {Object.keys(rest).length > 0 && (
            <span className="log-extra"> {JSON.stringify(rest)}</span>
          )}
        </div>
      );

      return { formatted, matchesFilter };
    } catch {
      // Not JSON, display as plain text
      const formatted = <div className="log-entry log-plain">{line}</div>;
      return { formatted, matchesFilter };
    }
  };

  const filteredLogs = logs
    .map((log, index) => {
      const { formatted, matchesFilter } = parseLogLine(log);
      return matchesFilter ? (
        <div key={index} className="log-line">
          {formatted}
        </div>
      ) : null;
    })
    .filter(Boolean);

  return (
    <div className={`log-window ${isVisible ? 'visible' : 'hidden'}`}>
      <div className="log-header">
        <button className="log-toggle" onClick={onToggle}>
          {isVisible ? '▼' : '▲'} Logs
        </button>
        <input
          type="text"
          className="log-filter"
          placeholder="Filter logs..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          disabled={!isVisible}
        />
        <label className="auto-scroll-label">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            disabled={!isVisible}
          />
          Auto-scroll
        </label>
        <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '● Connected' : '○ Disconnected'}
        </span>
      </div>
      {isVisible && (
        <div className="log-container" ref={logContainerRef}>
          {filteredLogs.length > 0 ? filteredLogs : (
            <div className="no-logs">No logs to display</div>
          )}
        </div>
      )}
    </div>
  );
}

export default LogWindow;