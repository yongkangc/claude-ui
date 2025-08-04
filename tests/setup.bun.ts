// Bun-compatible test setup file
process.env.NODE_ENV = 'test';

// Import test helpers if needed
import { TestHelpers } from './utils/test-helpers';

// Enable test logging for debugging
TestHelpers.setupTestLogging(false);