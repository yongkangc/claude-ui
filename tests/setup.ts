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