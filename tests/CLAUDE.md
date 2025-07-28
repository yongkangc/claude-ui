# Testing Guide for CUI

This directory contains comprehensive test coverage for CUI (Claude Code Web UI) backend and frontend services.

## Project Testing Philosophy

- **Prefer real implementations** over mocks when feasible
- **Comprehensive unit test coverage** targeting 90%+ for critical services
- **Mock Claude CLI** using `tests/__mocks__/claude` for consistent behavior
- **Silent logging** in tests (`LOG_LEVEL=silent`) to reduce noise
- **Random ports** for server tests to avoid conflicts

## Test Structure

```
tests/
├── __mocks__/
│   ├── claude                    # Mock Claude CLI executable
│   ├── mcp-server-mock.ts       # MCP server mock
│   └── mcp-stdio-mock.ts        # MCP stdio mock
├── integration/
│   ├── api-endpoints-availability.test.ts  # API endpoint health checks
│   ├── auth-integration.test.ts           # Authentication flow tests
│   ├── config-integration.test.ts         # Configuration tests
│   ├── conversation-status-integration.test.ts
│   ├── log-endpoints.test.ts              # Log streaming tests
│   ├── real-claude-integration.test.ts    # Tests with actual Claude CLI
│   └── streaming-integration.test.ts      # Real-time streaming tests
├── unit/
│   ├── claude-history-reader.test.ts
│   ├── claude-process-*.test.ts
│   ├── cli-parser.test.ts
│   ├── contexts/                 # React context tests
│   ├── conversation-status-manager.test.ts
│   ├── cui-server.test.ts
│   ├── middleware/               # Express middleware tests
│   ├── routes/                   # API route tests
│   ├── services/                 # Service layer tests
│   └── web/                      # Frontend component tests
├── utils/
│   └── test-helpers.ts           # Shared test utilities
└── setup.ts                      # Jest setup file
```

## Mock Claude CLI

The mock Claude CLI (`tests/__mocks__/claude`) simulates real Claude behavior:
- Outputs valid JSONL stream format
- Supports command line arguments (--output-format, --add-dir, --mcp-config, etc.)
- Generates realistic session IDs and message IDs
- Simulates token usage calculations
- Handles special test cases for predictable testing

## Practical Test Environment Setup

### Setting Up CUI Server with Random Port

```typescript
import { TestHelpers } from '@/tests/utils/test-helpers';

describe('My Feature Test', () => {
  let server: CUIServer;
  let baseUrl: string;
  
  beforeAll(async () => {
    // Create server with random port to avoid conflicts
    const port = 9000 + Math.floor(Math.random() * 1000);
    server = TestHelpers.createIntegrationTestServer({ port });
    
    await server.start();
    baseUrl = `http://localhost:${port}`;
  });
  
  afterAll(async () => {
    await server.stop();
  });
  
  it('should handle API requests', async () => {
    const response = await fetch(`${baseUrl}/api/system/status`);
    expect(response.status).toBe(200);
  });
});
```

### Mocking Common Components

#### 1. Mock Claude Process
```typescript
import { MockClaudeProcess, TestHelpers } from '@/tests/utils/test-helpers';

it('should handle Claude conversation', async () => {
  // Create mock process with predefined messages
  const mockProcess = new MockClaudeProcess(
    MockClaudeProcess.createSuccessfulConversation('test-session-123')
  );
  
  // Setup spawn mock to return our mock process
  TestHelpers.setupClaudeProcessMock(mockProcess);
  
  // Your test code here
  const result = await processManager.startConversation({
    message: 'Hello Claude',
    streamingId: 'test-stream'
  });
  
  expect(result.sessionId).toBe('test-session-123');
});
```

#### 2. Mock ConfigService
```typescript
beforeEach(() => {
  const { ConfigService } = require('@/services/config-service');
  jest.spyOn(ConfigService, 'getInstance').mockReturnValue({
    initialize: jest.fn().mockResolvedValue(undefined),
    getConfig: jest.fn().mockReturnValue({
      machine_id: 'test-machine-12345678',
      server: { host: 'localhost', port: 3001 },
      logging: { level: 'silent' },
      auth: { token: 'test-token' }
    })
  });
});
```

#### 3. Mock Logger
```typescript
const mockLogger = {
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
};

jest.mock('@/services/logger', () => ({
  createLogger: jest.fn(() => mockLogger)
}));
```

#### 4. Mock File System Operations
```typescript
import * as fs from 'fs/promises';

jest.mock('fs/promises');
const fsMock = fs as jest.Mocked<typeof fs>;

beforeEach(() => {
  fsMock.readFile.mockResolvedValue(Buffer.from('test content'));
  fsMock.writeFile.mockResolvedValue(undefined);
  fsMock.access.mockResolvedValue(undefined);
});
```

#### 5. Mock HTTP Responses
```typescript
const mockResponse = {
  writeHead: jest.fn(),
  write: jest.fn(),
  end: jest.fn(),
  setHeader: jest.fn(),
  on: jest.fn()
};

const mockRequest = {
  headers: { 'x-stream-id': 'test-stream' },
  url: '/api/stream/test-stream',
  method: 'GET'
};
```

### Common Test Utilities

#### Wait for Async Conditions
```typescript
// Wait for streaming messages
await TestHelpers.waitForStreamingMessages(
  receivedMessages,
  expectedCount: 4,
  timeoutMs: 3000
);

// General condition waiting
await TestHelpers.waitFor(
  () => processManager.getActiveConversations().length > 0,
  timeoutMs: 5000
);
```

#### Parse Streaming Data
```typescript
const messages = TestHelpers.parseStreamingData(rawStreamData);
const assistantMessage = messages.find(m => m.type === 'assistant');
```

#### Temporary Test Directories
```typescript
let testDir: string;

beforeEach(async () => {
  testDir = await TestHelpers.createTempTestDir();
});

afterEach(async () => {
  await TestHelpers.cleanupTempDir(testDir);
});
```

### Environment Variables for Tests

```typescript
// In test setup
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent'; // or 'debug' for troubleshooting
  process.env.CUI_TEST_MODE = 'true';
});

// Restore after tests
afterAll(() => {
  delete process.env.CUI_TEST_MODE;
});
```

### Common Testing Scenarios

#### Testing Streaming Connections
```typescript
describe('Streaming API', () => {
  let server: CUIServer;
  let streamingData: string[] = [];
  
  beforeAll(async () => {
    server = TestHelpers.createIntegrationTestServer({ port: 9500 });
    await server.start();
  });
  
  it('should stream conversation updates', async () => {
    const streamingId = 'test-stream-123';
    
    // Connect to stream
    const response = await fetch(`http://localhost:9500/api/stream/${streamingId}`);
    const reader = response.body!.getReader();
    
    // Collect streaming data
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      streamingData.push(decoder.decode(value));
    }
    
    // Verify stream data
    const messages = TestHelpers.parseStreamingData(streamingData.join(''));
    expect(messages).toContainEqual(
      expect.objectContaining({ type: 'assistant' })
    );
  });
});
```

#### Testing Permission Requests
```typescript
describe('MCP Permissions', () => {
  it('should handle permission approval', async () => {
    const requestId = 'perm-req-123';
    const mockTracker = {
      addDecision: jest.fn()
    };
    
    // Mock permission tracker
    jest.spyOn(PermissionTracker, 'getInstance').mockReturnValue(mockTracker);
    
    // Send approval decision
    const response = await fetch(
      `${baseUrl}/api/permissions/${requestId}/decision`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true })
      }
    );
    
    expect(response.status).toBe(200);
    expect(mockTracker.addDecision).toHaveBeenCalledWith(requestId, true);
  });
});
```

#### Testing Error Scenarios
```typescript
describe('Error Handling', () => {
  it('should handle process crash gracefully', async () => {
    const mockProcess = new MockClaudeProcess();
    TestHelpers.setupClaudeProcessMock(mockProcess);
    
    // Start conversation
    const result = await processManager.startConversation({
      message: 'test',
      streamingId: 'test-stream'
    });
    
    // Simulate crash
    mockProcess.emitError(new Error('Process crashed'));
    mockProcess.kill('SIGKILL');
    
    // Verify cleanup
    await TestHelpers.waitFor(
      () => processManager.getActiveConversations().length === 0
    );
    
    const status = processManager.getConversationStatus(result.sessionId);
    expect(status?.state).toBe('error');
  });
});
```

#### Testing Authentication
```typescript
describe('Authentication', () => {
  let server: CUIServer;
  
  beforeAll(async () => {
    // Setup server with auth enabled
    jest.spyOn(ConfigService, 'getInstance').mockReturnValue({
      getConfig: jest.fn().mockReturnValue({
        auth: { token: 'secret-token', enabled: true }
      })
    });
    
    server = TestHelpers.createIntegrationTestServer();
    await server.start();
  });
  
  it('should reject requests without token', async () => {
    const response = await fetch(`${baseUrl}/api/conversations`);
    expect(response.status).toBe(401);
  });
  
  it('should accept requests with valid token', async () => {
    const response = await fetch(`${baseUrl}/api/conversations`, {
      headers: { 'Authorization': 'Bearer secret-token' }
    });
    expect(response.status).toBe(200);
  });
});
```

## Testing Patterns

### Integration Tests
```typescript
// Use test helpers for consistent setup
const server = TestHelpers.createIntegrationTestServer({ 
  port: 9000 + Math.floor(Math.random() * 1000) 
});

// Override ProcessManager with mock Claude
const mockClaudePath = path.join(process.cwd(), 'tests', '__mocks__', 'claude');
(server as any).processManager = new ClaudeProcessManager(mockClaudePath);
```

### Unit Tests
```typescript
// Use centralized mock setup
import { mockLogger } from '@/tests/utils/test-helpers';

// Test with proper cleanup
afterEach(() => {
  jest.clearAllMocks();
});
```

### API Testing
```typescript
// Test helper for endpoint verification
const verifyEndpoints = async (baseUrl: string) => {
  const endpointChecks = [
    { path: '/api/system/status', method: 'GET', expectedStatus: 200 },
    { path: '/api/conversations', method: 'GET', expectedStatus: 200 }
  ];

  const results = await Promise.all(
    endpointChecks.map(async ({ path, method, expectedStatus }) => {
      const response = await fetch(`${baseUrl}${path}`, { method });
      return { path, status: response.status, success: response.status === expectedStatus };
    })
  );
  
  return results.filter(r => !r.success);
};
```

## Test Configuration

Jest configuration (`jest.config.js`):
- TypeScript support via `ts-jest`
- Path aliases matching source (`@/` → `src/`)
- Coverage thresholds: 75% lines, 80% functions
- Serial execution for integration tests (`maxWorkers: 1`)
- 10-second timeout for async operations

## Running Tests

```bash
# All tests
npm run test

# Unit tests only
npm run unit-tests

# Integration tests only  
npm run integration-tests

# With coverage
npm run test:coverage

# Watch mode for TDD
npm run test:watch

# Specific test file
npx jest tests/unit/services/ClaudeProcessManager.test.ts

# Test by name pattern
npx jest -t "should start conversation"

# Debug mode (shows logs)
npm run test:debug
```

## Key Testing Considerations

### 1. Authentication Tests
- Test both token-based and skip-auth modes
- Verify middleware properly rejects invalid tokens
- Check auth headers in streaming endpoints

### 2. Process Management Tests
- Mock process spawning to avoid real Claude CLI calls
- Test error handling for process crashes
- Verify proper cleanup on shutdown

### 3. Streaming Tests
- Test connection lifecycle (connect, stream, disconnect)
- Verify proper event listener cleanup
- Test concurrent streaming connections

### 4. MCP Permission Tests
- Mock MCP server interactions
- Test permission request/approval flow
- Verify timeout handling

### 5. Frontend Tests
- Use React Testing Library for component tests
- Test hooks with `renderHook`
- Mock API calls with MSW or manual mocks

## Common Gotchas

1. **Build before first test**: Run `npm run build` to compile MCP executable
2. **Port conflicts**: Always use random ports in integration tests
3. **Process cleanup**: Ensure child processes are killed in afterEach/afterAll
4. **Async timeouts**: Increase timeout for slow operations
5. **Mock paths**: Use absolute paths for mock Claude executable

## Writing New Tests

1. **Follow existing patterns**: Check similar tests for consistency
2. **Use descriptive names**: `describe` blocks should read like documentation
3. **Test edge cases**: Invalid inputs, timeouts, concurrent operations
4. **Mock minimally**: Only mock what's necessary for isolation
5. **Clean up resources**: Close servers, kill processes, clear timers

## Debugging Tests

```bash
# Enable debug logs
LOG_LEVEL=debug npm run test

# Run single test with console output
node --inspect-brk node_modules/.bin/jest tests/unit/specific.test.ts

# Check for hanging tests
npm run test -- --detectOpenHandles
```

## Test Data

- Mock conversation IDs follow UUID format
- Mock message IDs use `msg_` prefix with hex string
- Test prompts have predictable responses for assertions
- Use `test-helpers.ts` for common test utilities

## Coverage Goals

- Unit tests: 90%+ coverage for services and utilities
- Integration tests: Cover all API endpoints
- E2E tests: Critical user flows (start conversation, stream response, handle permissions)

Remember: Good tests are documentation. They should clearly show how the system is intended to work.