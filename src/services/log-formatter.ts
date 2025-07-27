import { Transform } from 'stream';

interface LogObject {
  level: number;
  time: number | string;
  msg: string;
  component?: string;
  requestId?: string;
  sessionId?: string;
  streamingId?: string;
  [key: string]: any;
}

const LEVELS: Record<number, { label: string; color: string }> = {
  10: { label: 'TRACE', color: '\x1b[90m' },    // gray
  20: { label: 'DEBUG', color: '\x1b[36m' },    // cyan
  30: { label: 'INFO', color: '\x1b[32m' },     // green
  40: { label: 'WARN', color: '\x1b[33m' },     // yellow
  50: { label: 'ERROR', color: '\x1b[31m' },    // red
  60: { label: 'FATAL', color: '\x1b[35m' }     // magenta
};

const RESET = '\x1b[0m';
const GRAY = '\x1b[90m';
const BOLD = '\x1b[1m';
const BLUE = '\x1b[34m';

export class LogFormatter extends Transform {
  constructor() {
    super({
      writableObjectMode: true,
      transform(chunk: any, encoding: string, callback: Function) {
        try {
          const logLine = chunk.toString().trim();
          if (!logLine) {
            callback();
            return;
          }

          const log: LogObject = JSON.parse(logLine);
          const formatted = formatLog(log);
          callback(null, formatted + '\n');
        } catch (err) {
          // If we can't parse it, pass it through as-is
          callback(null, chunk);
        }
      }
    });
  }
}

function formatLog(log: LogObject): string {
  // Format timestamp in 12-hour format with AM/PM
  const time = new Date(typeof log.time === 'string' ? log.time : log.time);
  const hours = time.getHours();
  const minutes = time.getMinutes().toString().padStart(2, '0');
  const seconds = time.getSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = (hours % 12 || 12).toString().padStart(2, '0');
  const timestamp = `${displayHours}:${minutes}:${seconds} ${ampm}`;

  // Get level info
  const levelInfo = LEVELS[log.level] || { label: 'UNKNOWN', color: '' };

  // Build the formatted message
  let formatted = `${GRAY}${timestamp}${RESET}`;

  // Add component in bold blue brackets if present
  if (log.component) {
    formatted += ` ${BOLD}${BLUE}[${log.component}]${RESET}`;
  }

  // Add the main message
  formatted += ` ${log.msg}`;

  // Add context fields (filter out only pino internals)
  const excludedFields = ['level', 'time', 'msg', 'component', 'pid', 'hostname', 'v'];
  const contextFields = Object.keys(log)
    .filter(key => !excludedFields.includes(key) && log[key] !== undefined && log[key] !== null);

  if (contextFields.length > 0) {
    const contextPairs = contextFields.map(key => {
      const value = log[key];
      
      // Special handling for error objects
      if ((key === 'err' || key === 'error') && typeof value === 'object' && value.message) {
        return `${key}="${value.message}"`;
      }
      
      // Format based on value type
      if (typeof value === 'string') {
        return `${key}="${value}"`;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        return `${key}=${value}`;
      } else {
        // For objects and arrays, use JSON.stringify
        return `${key}=${JSON.stringify(value)}`;
      }
    });
    
    formatted += ` ${GRAY}${contextPairs.join(' ')}${RESET}`;
  }

  // Handle error stack traces
  if (log.err && log.err.stack) {
    formatted += `\n${log.err.stack}`;
  }

  return formatted;
}