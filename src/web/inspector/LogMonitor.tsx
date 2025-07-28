import React, { useState, useEffect, useRef } from 'react';
import styles from './styles/inspector.module.css';
import { api } from '../chat/services/api';

interface LogEntry {
  timestamp: string;
  level: string;
  component?: string;
  msg: string;
  [key: string]: any;
}

interface LogMonitorProps {
  isVisible: boolean;
  onToggle: () => void;
}

function LogMonitor({ isVisible, onToggle }: LogMonitorProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
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


  const connectToLogStream = async () => {
    try {
      // First get recent logs
      try {
        const recentData = await api.getRecentLogs(100);
        if (recentData.logs) {
          setLogs(recentData.logs);
        }
      } catch (error) {
        console.error('Failed to get recent logs:', error);
      }

      // Then connect to stream
      const response = await api.fetchWithAuth(api.getLogStreamUrl());
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
    <div className={`${styles.logMonitor} ${isVisible ? styles.visible : styles.hidden}`}>
      <div className={styles.logHeader}>
        <button className={styles.logToggle} onClick={onToggle}>
          {isVisible ? '▼' : '▲'} Logs
        </button>
        <input
          type="text"
          className={styles.logFilter}
          placeholder="Filter logs..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          disabled={!isVisible}
        />
        <button 
          className={styles.logToggle} 
          onClick={() => setLogs([])}
          disabled={!isVisible}
        >
          Clear
        </button>
        <span className={`${styles.connectionStatus} ${isConnected ? styles.connected : styles.disconnected}`}>
          {isConnected ? '● Connected' : '○ Disconnected'}
        </span>
      </div>
      {isVisible && (
        <div className={styles.logContainer} ref={logContainerRef}>
          {filteredLogs.length > 0 ? filteredLogs : (
            <div className={styles.noLogs}>No logs to display</div>
          )}
        </div>
      )}
    </div>
  );
}

export default LogMonitor;