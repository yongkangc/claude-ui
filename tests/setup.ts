// Test setup file
import { TestHelpers } from './utils/test-helpers';

// Set test environment variables
process.env.NODE_ENV = 'test';

// Check if LOG_LEVEL was passed from command line (e.g., LOG_LEVEL=debug npm test)
const isDebugMode = process.env.LOG_LEVEL === 'debug';

// Default to silent unless explicitly set
if (!process.env.LOG_LEVEL) {
  process.env.LOG_LEVEL = 'silent';
}

// Enable test logging for debugging
TestHelpers.setupTestLogging(false);

// Only suppress logs if not in debug mode
if (!isDebugMode) {
  // Suppress console.error during tests to reduce noise
  console.error = jest.fn();

  // Suppress pino JSON logs by mocking stdout.write for JSON logs
  const originalWrite = process.stdout.write;
  process.stdout.write = function(chunk: any, ...args: any[]) {
    // Check if the chunk looks like a pino JSON log
    if (typeof chunk === 'string' && (chunk.startsWith('{"level":') || chunk.includes('"time":'))) {
      return true; // Suppress the log
    }
    return originalWrite.call(this, chunk, ...args);
  };
}

// Configure Jest timeout for integration tests
jest.setTimeout(30000);