# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CCUI (Claude Code Web UI) is a backend server that provides a web interface for managing Claude CLI processes. The project enables users to interact with Claude through a web browser rather than the command line, offering features like conversation management, real-time streaming, and permission handling through the Model Context Protocol (MCP).

## Development Commands

### Backend Development

```bash
# Development server with hot reloading (uses tsx)
npm run dev

# Build TypeScript to JavaScript with path alias resolution
npm run build

# Run the CLI after building
npm run cli

# Run all tests
npm test

# Run unit tests only
npm run unit-tests

# Run integration tests only
npm run integration-tests

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Lint TypeScript files
npm run lint

# Type checking without compilation
npm run typecheck
```

### CLI Commands

The project includes a CLI interface built with Commander.js:

```bash
# Start the CCUI backend server
ccui serve --port 3001

# Start MCP permission server
ccui mcp --config ./config/mcp-config.json

# List all conversations
ccui list --project /path/to/project --limit 20 --json

# Get conversation details
ccui get <sessionId> --json

# Get system status
ccui status --json
```

### Test Commands
```bash
# Run specific test files
npm test -- claude-process-manager.test.ts
npm test -- tests/unit/

# Run tests matching a pattern
npm test -- --testNamePattern="should start conversation"

# Run unit tests only
npm run unit-tests

# Run integration tests only
npm run integration-tests
```

## Architecture Overview

### Core Components

The backend follows a service-oriented architecture with these key components:

- **CCUIServer** (`src/ccui-server.ts`) - Main Express server that coordinates all components
- **ClaudeProcessManager** (`src/services/claude-process-manager.ts`) - Manages Claude CLI process lifecycle
- **StreamManager** (`src/services/stream-manager.ts`) - Handles client streaming connections  
- **ClaudeHistoryReader** (`src/services/claude-history-reader.ts`) - Reads conversation history from ~/.claude
- **JsonLinesParser** (`src/services/json-lines-parser.ts`) - Parses JSONL streams from Claude CLI

### Data Flow Architecture

1. **Frontend** makes REST API calls to start/manage conversations
2. **Backend** spawns Claude CLI processes independently
3. **Claude CLI** outputs JSONL streams that are parsed and forwarded
4. **JsonLinesParser** transforms Claude output into structured events
5. **StreamManager** provides real-time updates to connected web clients via HTTP streaming

### File Structure Conventions

- **kebab-case** for all TypeScript file names (e.g., `claude-process-manager.ts`)
- **PascalCase** for class names (e.g., `ClaudeProcessManager`)
- **camelCase** for variables and functions
- **Path aliases** use `@/` prefix (e.g., `import { StreamManager } from '@/services/stream-manager'`)

## Key Implementation Details

### Claude Process Management
Each conversation runs as a separate `claude` CLI child process with these characteristics:

```typescript
class ClaudeProcessManager {
  private processes: Map<string, ChildProcess> = new Map();
  private outputBuffers: Map<string, string> = new Map();
  private timeouts: Map<string, NodeJS.Timeout[]> = new Map();
  
  async startConversation(config: ConversationConfig): Promise<string> {
    const streamingId = uuidv4(); // CCUI's internal streaming identifier
    
    // Build Claude CLI command with required flags
    const args = [
      '-p',                            // Print mode for programmatic use
      config.initialPrompt,            // Initial prompt immediately after -p
      '--output-format', 'stream-json', // JSONL output format
      '--verbose',                     // Required when using stream-json with print mode
      '--max-turns', '10',             // Allow multiple turns
      '--add-dir', config.workingDirectory
    ];
    
    if (config.model) {
      args.push('--model', config.model);
    }
    
    const process = spawn('claude', args, {
      cwd: config.workingDirectory,
      stdio: ['inherit', 'pipe', 'pipe']
    });
    
    this.processes.set(streamingId, process);
    this.setupProcessHandlers(streamingId, process);
    return streamingId;
  }
}
```

**Process Lifecycle:**
- Spawn with `child_process.spawn()` for real-time output streaming  
- Each Claude CLI call is independent - starts, runs, outputs result, exits
- Parse JSONL output incrementally using custom `JsonLinesParser`
- Handle graceful shutdown with SIGTERM/SIGKILL fallback
- Automatic cleanup on process termination

**Important:** Claude CLI in print mode (`-p`) runs once and exits. It does not accept stdin input for continuing conversations.

## Testing Architecture

### Testing Philosophy
- **Prefer real implementations** over mocks when testing (per project guidelines)
- **Comprehensive unit test coverage** for all services (90%+ target)
- **Mock Claude CLI** using `tests/__mocks__/claude` script for consistent testing
- **Silent logging** in tests (LOG_LEVEL=silent) to reduce noise

### Test Structure
```
tests/
├── unit/                    # Unit tests for all services
│   ├── ccui-server.test.ts  # Server integration tests
│   ├── claude-process-manager.test.ts
│   ├── stream-manager.test.ts
│   ├── claude-history-reader.test.ts
│   ├── json-lines-parser.test.ts
│   └── cli/                 # CLI command tests
├── __mocks__/               # Test mocks
│   └── claude               # Mock Claude CLI script
├── setup.ts                 # Jest test configuration
└── utils/
    └── test-helpers.ts      # Testing utilities
```

### Mock Claude CLI
The project includes a mock Claude CLI (`tests/__mocks__/claude`) that:
- Simulates real Claude CLI behavior for testing
- Outputs valid JSONL stream format
- Supports various command line arguments
- Enables testing without requiring actual Claude CLI installation

### Test Configuration
- **Jest** with `ts-jest` preset for TypeScript support
- **Path mapping** using `@/` aliases matching source structure
- **30-second timeout** for integration tests
- **Force exit** to prevent hanging processes
- **Coverage collection** from all source files

## Code Practices and Guidelines

### File Organization
- **Service classes** in `src/services/` for core business logic
- **Type definitions** centralized in `src/types/index.ts`
- **CLI commands** in `src/cli/commands/` with Commander.js
- **Path aliases** using `@/` prefix for clean imports

### Error Handling
- **Custom CCUIError class** with error codes and HTTP status codes
- **Structured logging** using Pino with context information
- **Graceful process shutdown** with SIGTERM/SIGKILL fallback
- **Stream error handling** with automatic client cleanup

### Development Practices
- **TypeScript strict mode** for type safety
- **ESLint** for code quality and consistency
- **Meaningful test names** and comprehensive test coverage
- **Event-driven architecture** using Node.js EventEmitter
- **Stateless design** for scalability

## API Endpoints

### Conversation Management
- `POST /api/conversations/start` - Start new conversation with Claude CLI
- `GET /api/conversations` - List conversation history with filtering
- `GET /api/conversations/:sessionId` - Get full conversation details
- `POST /api/conversations/:streamingId/stop` - Stop active conversation

### Streaming
- `GET /api/stream/:streamingId` - HTTP streaming endpoint for real-time updates
- Uses newline-delimited JSON format (not Server-Sent Events)
- Supports multiple clients per conversation session

### System
- `GET /api/system/status` - System status including Claude version and active conversations
- `GET /health` - Health check endpoint

## Configuration

### Environment Variables
```bash
PORT=3001                                    # Server port
LOG_LEVEL=info                              # Logging level (silent, debug, info, warn, error)
CLAUDE_HOME_PATH=~/.claude                  # Claude CLI home directory
```

### MCP Configuration
Model Context Protocol configuration in `config/mcp-config.json`:
```json
{
  "mcpServers": {
    "ccui": {
      "command": "node",
      "args": ["./dist/mcp-server/index.js"],
      "env": {
        "CCUI_API_URL": "http://localhost:3001"
      }
    }
  }
}
```

## Development Status

This is a **fully functional implementation** with:
- ✅ Complete Claude CLI process management
- ✅ HTTP streaming with newline-delimited JSON
- ✅ Conversation history reading from `~/.claude`
- ✅ Comprehensive test coverage
- ✅ CLI interface with multiple commands
- ✅ Error handling and graceful shutdown
- ✅ Structured logging and monitoring
- ✅ TypeScript type safety throughout

The backend is production-ready and provides a robust foundation for web-based Claude CLI interaction.