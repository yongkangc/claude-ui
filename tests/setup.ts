// Test setup file
import { TestHelpers } from './utils/test-helpers';

// Set test environment variables
process.env.NODE_ENV = 'test';

// Note: Log level is controlled by LOG_LEVEL environment variable
// Debug logs are enabled when LOG_LEVEL=debug is set (see logger.ts)

// Enable test logging for debugging
TestHelpers.setupTestLogging(false);

// Configure Jest timeout for integration tests
jest.setTimeout(30000);

// Global cleanup to ensure all timers are cleared after tests
afterAll(async () => {
  // Clear all timers
  jest.clearAllTimers();
  jest.useRealTimers();
  
  // Give async operations a chance to complete
  await new Promise(resolve => setTimeout(resolve, 0));
});