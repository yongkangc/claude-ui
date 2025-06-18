// Test setup file
import { TestHelpers } from './utils/test-helpers';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent'; // Suppress all logs in tests

// Enable test logging for debugging
TestHelpers.setupTestLogging(false);

// Suppress console.error during tests to reduce noise
console.error = jest.fn();

// Suppress pino JSON logs by mocking stdout.write for JSON logs
const originalWrite = process.stdout.write;
process.stdout.write = function(chunk: any, ...args: any[]) {
  // Check if the chunk looks like a pino JSON log
  if (typeof chunk === 'string' && chunk.startsWith('{"level":')) {
    return true; // Suppress the log
  }
  return originalWrite.call(this, chunk, ...args);
};

// Configure Jest timeout for integration tests
jest.setTimeout(30000);