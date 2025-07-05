// Test setup file
import { TestHelpers } from './utils/test-helpers';

// Set test environment variables
process.env.NODE_ENV = 'test';

// Note: Log level is now controlled by config, not environment variables
// Tests run with silent logging by default (see logger.ts)

// Enable test logging for debugging
TestHelpers.setupTestLogging(false);

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

// Configure Jest timeout for integration tests
jest.setTimeout(30000);