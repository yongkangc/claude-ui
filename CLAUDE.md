# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code, cc in short) when working with code in this repository.

## Project Overview

CCUI (Claude Code Web UI) is a backend server that provides a web interface for managing Claude CLI processes. The project enables users to interact with Claude through a web browser rather than the command line, offering features like conversation management, real-time streaming, and permission handling through the Model Context Protocol (MCP).

## Development Commands

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

# Lint TypeScript files
npm run lint
```

> For CLI commands and testing details, see `src/cli/CLAUDE.md` and `tests/CLAUDE.md`

## Architecture Overview

### Core Components

The backend follows a service-oriented architecture with these key components:

- **CCUIServer** (`src/ccui-server.ts`) - Main Express server that coordinates all components
- **ClaudeProcessManager** (`src/services/claude-process-manager.ts`) - Manages Claude CLI process lifecycle
- **StreamManager** (`src/services/stream-manager.ts`) - Handles client streaming connections  
- **ClaudeHistoryReader** (`src/services/claude-history-reader.ts`) - Reads conversation history from ~/.claude and provides working directory lookup
- **ConversationStatusTracker** (`src/services/conversation-status-tracker.ts`) - Tracks conversation status based on active streams
- **JsonLinesParser** (`src/services/json-lines-parser.ts`) - Parses JSONL streams from Claude CLI

> For detailed service architecture and implementation patterns, see `src/services/CLAUDE.md`

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

## Core Type Definitions

> For complete type definitions and data structures, see `src/types/CLAUDE.md`

Key types include:
- **Stream Message Types**: SystemInitMessage, AssistantStreamMessage, UserStreamMessage, ResultStreamMessage
- **Content Block System**: TextBlock, ToolUseBlock, ThinkingBlock, etc.
- **API Request/Response Types**: StartConversationRequest, ConversationSummary, etc.
- **Configuration Types**: ConversationConfig
- **Stream Event Types**: StreamEvent union type
- **Tool Definitions**: FileOperationTools, SearchTools, ExecutionTools, etc.

## Key Implementation Details

> For detailed implementation patterns and service architecture, see `src/services/CLAUDE.md`

**Claude Process Management:**
- Each conversation runs as a separate `claude` CLI child process
- Uses `child_process.spawn()` for real-time output streaming
- Parse JSONL output incrementally using custom `JsonLinesParser`
- Handle graceful shutdown with SIGTERM/SIGKILL fallback

**Important:** Claude CLI in print mode (`-p`) runs once and exits. It does not accept stdin input for continuing conversations.

## Testing Architecture

> For comprehensive testing details, patterns, and mock setup, see `tests/CLAUDE.md`

**Testing Philosophy:**
- Prefer real implementations over mocks when testing
- Comprehensive unit test coverage for all services (90%+ target)
- Mock Claude CLI using `tests/__mocks__/claude` script
- Silent logging in tests (LOG_LEVEL=silent)

**Key Features:**
- Jest with `ts-jest` preset for TypeScript support
- Path mapping using `@/` aliases matching source structure
- Custom mock Claude CLI that outputs valid JSONL stream format

## Code Practices and Guidelines

### File Organization
- **Service classes** in `src/services/` for core business logic
- **Type definitions** centralized in `src/types/index.ts`
- **CLI commands** in `src/cli/commands/` with Commander.js
- **Path aliases** using `@/` prefix for clean imports

> See subdirectory CLAUDE.md files for detailed implementation patterns:
> - `src/services/CLAUDE.md` - Service architecture and error handling
> - `src/cli/CLAUDE.md` - CLI command patterns
> - `src/types/CLAUDE.md` - Type definitions and data structures
> - `tests/CLAUDE.md` - Testing philosophy and patterns

### Development Practices
- **TypeScript strict mode** for type safety
- **ESLint** for code quality and consistency
- **Event-driven architecture** using Node.js EventEmitter
- **Stateless design** for scalability

## API Endpoints

### Conversation Management
- `POST /api/conversations/start` - Start new conversation with Claude CLI
- `POST /api/conversations/resume` - Resume existing conversation with session ID and new message
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

### Resume Conversation

Resume existing conversations using Claude CLI's `--resume` functionality:

**API Usage:**
```json
POST /api/conversations/resume
{
  "sessionId": "claude-session-id",
  "message": "Continue with this message"
}
```

Returns new streaming ID for continued conversation. Session parameters are inherited from original conversation.

### Conversation Status Tracking

The backend automatically tracks conversation status based on active streaming connections:

**Status Values:**
- `completed`: Conversation has finished and no active stream exists (default)
- `ongoing`: Conversation has an active streaming connection (currently being processed)
- `pending`: Reserved for future features (not currently used)

Ongoing conversations include an optional `streamingId` field in API responses for connecting to active streams or stopping conversations.

## Configuration

### Environment Variables
```bash
PORT=3001                                    # Server port
LOG_LEVEL=info                              # Logging level (silent, debug, info, warn, error)
CLAUDE_HOME_PATH=~/.claude                  # Claude CLI home directory
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

## Session ID Architecture

CCUI maintains **two separate session ID systems**:

1. **CCUI Streaming ID** (`streamingId`): Internal UUID for managing active processes and streaming connections
2. **Claude CLI Session ID** (`session_id`): Claude's internal session tracking, used in history files

## CC Patterns

> For Claude CLI command construction patterns and conversation history structure, see `src/cli/CLAUDE.md`

## Important Notes

- **Logging**: Always use `@/services/logger.ts` for logging. NEVER USE CONSOLE.LOG in production code
- **API Documentation**: Update `@cc-workfiles/knowledge/API.md` after altering API endpoints
- **Web UI**: Update `/public/index.html` when API endpoints change to keep the raw JSON interface in sync
- **Claude CLI Streaming**: See `@cc-workfiles/knowledge/example-cc-stream-json.md` to understand raw JSONL output format
- **Integration Testing**: See `@cc-workfiles/knowledge/cc-with-fake-home-example.txt` for Claude CLI behavior with fake home directories
- **Claude Home Structure**: See `@cc-workfiles/knowledge/example-cc-config-folder.md` for `.claude` directory structure
- **Process Independence**: Each conversation runs as a separate Claude CLI child process