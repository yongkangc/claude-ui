# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CCUI (Claude Code Web UI) is a backend server that provides a web interface for managing Claude CLI processes. The project enables users to interact with Claude through a web browser rather than the command line, offering features like conversation management, real-time streaming, and permission handling through the Model Context Protocol (MCP).

## Development Commands

### Backend Development

```bash
# Development server with hot reloading
npm run dev

# Build TypeScript to JavaScript
npm run build

# Start production server (requires build first)
npm run start

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Lint TypeScript files
npm run lint

# Type checking without compilation
npm run typecheck
```

### Test Commands
```bash
# Run specific test files
npm test -- claude-process-manager.test.ts
npm test -- tests/unit/
npm test -- tests/integration/

# Run tests matching a pattern
npm test -- --testNamePattern="should start conversation"
```

## Architecture Overview

### Core Components

The backend follows a service-oriented architecture with these key components:

- **CCUIServer** (`src/ccui-server.ts`) - Main Express server that coordinates all components
- **ClaudeProcessManager** (`src/services/claude-process-manager.ts`) - Manages Claude CLI process lifecycle
- **StreamManager** (`src/services/stream-manager.ts`) - Handles client streaming connections  
- **ClaudeHistoryReader** (`src/services/claude-history-reader.ts`) - Reads conversation history from ~/.claude
- **CCUIMCPServer** (`src/mcp-server/ccui-mcp-server.ts`) - MCP server for permission handling
- **JsonLinesParser** (`src/services/json-lines-parser.ts`) - Parses JSONL streams from Claude CLI

### Data Flow Architecture

```
Frontend (Browser) ──► CCUI Backend ──► Claude CLI Process
        │                     │                │
        │                     ▼                │
        └──────────────► MCP Server ◄──────────┘
                    (Permission Handling)
```

1. **Frontend** makes REST API calls to start/manage conversations
2. **Backend** spawns Claude CLI processes with MCP configuration
3. **Claude CLI** outputs JSONL streams that are parsed and forwarded
4. **MCP Server** handles permission requests between Claude and the web interface
5. **Streaming** provides real-time updates to connected web clients

### File Structure Conventions

- **kebab-case** for all TypeScript file names (e.g., `claude-process-manager.ts`)
- **PascalCase** for class names (e.g., `ClaudeProcessManager`)
- **camelCase** for variables and functions
- **Path aliases** use `@/` prefix (e.g., `import { StreamManager } from '@/services/stream-manager'`)

## Key Implementation Details

### Claude Process Management
- Each conversation runs as a separate `claude` CLI child process
- Processes communicate via JSONL (newline-delimited JSON) streams
- The backend parses JSONL output incrementally and forwards to web clients
- Process lifecycle includes graceful shutdown with SIGTERM/SIGKILL fallback

### MCP Integration
- Uses Model Context Protocol for permission requests
- Claude calls the `permission_prompt` tool when it needs user approval
- Backend streams permission requests to web clients in real-time
- User decisions are sent back through REST API to approve/deny tool usage

### Streaming Architecture
- Uses HTTP streaming with newline-delimited JSON (not Server-Sent Events)
- Multiple clients can connect to the same conversation session
- Stream events include: connection confirmation, Claude messages, permission requests, errors

### Error Handling
- Custom `CCUIError` class with error codes and HTTP status codes
- Graceful handling of process failures and cleanup
- Proper error propagation through Express middleware

## Testing Strategy

### Test Structure
- **Unit tests** (`tests/unit/`) - Test individual service classes in isolation
- **Integration tests** (`tests/integration/`) - Test API endpoints and streaming functionality
- **Mocks** (`tests/__mocks__/`) - Mock external dependencies like MCP SDK

### Test Requirements
- Maintain >90% test coverage
- All new features must include corresponding tests
- Tests should not be modified unless fixing actual bugs
- Use the existing mock patterns for external dependencies

### Running Tests
Tests are configured with:
- **Jest** as the test runner
- **ts-jest** for TypeScript support
- **supertest** for HTTP endpoint testing
- **Path aliases** configured to match source code structure

## Configuration

### Environment Variables
```bash
PORT=3001                           # Server port
CLAUDE_HOME_PATH=~/.claude          # Claude data directory
MCP_CONFIG_PATH=./config/mcp-config.json  # MCP configuration
LOG_LEVEL=info                      # Logging level (debug, info, warn, error)
```

### MCP Configuration
The `config/mcp-config.json` file configures the MCP server for permission handling:
```json
{
  "mcpServers": {
    "ccui": {
      "command": "node",
      "args": ["./dist/mcp-server/index.js"]
    }
  }
}
```

## Development Guidelines

### Code Style
- Follow existing TypeScript patterns and interfaces
- Use proper error handling with `CCUIError` class
- Implement comprehensive logging with Pino
- Maintain type safety - avoid `any` types where possible

### Adding New Features
1. Define TypeScript interfaces in `src/types/index.ts`
2. Implement core logic in appropriate service class
3. Add REST API endpoints in `CCUIServer`
4. Write unit tests for service logic
5. Write integration tests for API endpoints
6. Update this CLAUDE.md file if architectural changes are made

### Working with Claude CLI
- Claude CLI must be installed and available in PATH
- Use `--output-format stream-json` for JSONL output
- Configure MCP with `--mcp-config` and `--permission-prompt-tool` flags
- Grant directory access with `--add-dir` flag

### Debugging
- Check server logs for process spawn failures
- Verify Claude CLI is properly installed (`claude --version`)
- Ensure MCP configuration file is valid JSON
- Monitor process lifecycle through `ClaudeProcessManager` events

## API Documentation

The backend provides REST endpoints for:
- **Conversation Management** - Start, list, continue, and stop conversations
- **Streaming** - Real-time updates via HTTP streaming
- **Permissions** - Handle MCP permission requests
- **System** - Status and model information

See the implementation plan (`cc-workfiles/plans/implementation-plan-v1.md`) for detailed API specifications.