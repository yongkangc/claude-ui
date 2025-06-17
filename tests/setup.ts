// Test setup file
import { TestHelpers } from './utils/test-helpers';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'warn'; // Reduce log noise in tests

// Enable test logging for debugging
TestHelpers.setupTestLogging(false);

// Configure Jest timeout for integration tests
jest.setTimeout(30000);