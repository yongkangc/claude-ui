import { EventEmitter } from 'events';

export interface LogEntry {
  timestamp: string;
  level: string;
  component?: string;
  msg: string;
  [key: string]: any;
}

export class LogStreamBuffer extends EventEmitter {
  private buffer: string[] = [];
  private maxBufferSize: number;
  
  constructor(maxBufferSize: number = 1000) {
    super();
    this.maxBufferSize = maxBufferSize;
  }
  
  public addLog(logLine: string): void {
    // Add to buffer
    this.buffer.push(logLine);
    
    // Maintain buffer size
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }
    
    // Emit for real-time streaming
    this.emit('log', logLine);
  }
  
  public getRecentLogs(limit?: number): string[] {
    if (!limit || limit >= this.buffer.length) {
      return [...this.buffer];
    }
    
    return this.buffer.slice(-limit);
  }
  
  public clear(): void {
    this.buffer = [];
  }
}

// Singleton instance
export const logStreamBuffer = new LogStreamBuffer();