import React, { useState, useEffect, useRef } from 'react';
import styles from './LogViewer.module.css';

interface LogEntry {
  timestamp: string;
  level: string;
  component?: string;
  msg: string;
  [key: string]: any;
}

export function LogViewer() {
  const [logs, setLogs] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  useEffect(() => {
    connectToLogStream();

    return () => {
      if (readerRef.current) {
        readerRef.current.cancel();
        readerRef.current = null;
      }
    };
  }, []);

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

  const clearLogs = () => {
    setLogs([]);
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
        'debug': 'var(--color-text-secondary)',
        'info': 'var(--color-success)',
        'warn': 'var(--color-warning)',
        'error': 'var(--color-error)',
        'fatal': 'var(--color-error)'
      };
      const levelColor = levelColors[level] || 'var(--color-text-primary)';

      // Build compact display
      const formatted = (
        <div className={styles.logEntry}>
          <span className={styles.logTime}>{timestamp}</span>
          <span className={styles.logLevel} style={{ color: levelColor }}>[{level?.toUpperCase() || 'LOG'}]</span>
          {component && <span className={styles.logComponent}>[{component}]</span>}
          <span className={styles.logMessage}>{msg}</span>
          {requestId && <span className={styles.logExtra}> (req: {requestId})</span>}
          {Object.keys(rest).length > 0 && (
            <span className={styles.logExtra}> {JSON.stringify(rest)}</span>
          )}
        </div>
      );

      return { formatted, matchesFilter };
    } catch {
      // Not JSON, display as plain text
      const formatted = <div className={`${styles.logEntry} ${styles.logPlain}`}>{line}</div>;
      return { formatted, matchesFilter };
    }
  };

  const filteredLogs = logs
    .map((log, index) => {
      const { formatted, matchesFilter } = parseLogLine(log);
      return matchesFilter ? (
        <div key={index} className={styles.logLine}>
          {formatted}
        </div>
      ) : null;
    })
    .filter(Boolean);

  return (
    <div className={styles.logViewer}>
      <div className={styles.header}>
        <input
          type="text"
          className={styles.filterInput}
          placeholder="Filter logs..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          className={styles.clearButton}
          onClick={clearLogs}
          title="Clear logs"
        >
          Clear
        </button>
        <span className={`${styles.connectionStatus} ${isConnected ? styles.connected : styles.disconnected}`}>
          {isConnected ? '● Connected' : '○ Disconnected'}
        </span>
      </div>
      <div className={styles.logContainer} ref={logContainerRef}>
        {filteredLogs.length > 0 ? filteredLogs : (
          <div className={styles.noLogs}>No logs to display</div>
        )}
      </div>
    </div>
  );
}