# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code, cc in short) when working with code in this repository.

## Project Overview

CCUI (Claude Code Web UI) is a backend server that provides a web interface for managing Claude CLI processes. The project enables users to interact with Claude through a web browser rather than the command line, offering features like conversation management, real-time streaming, and permission handling through the Model Context Protocol (MCP).

### MCP Permission System

CCUI includes an integrated MCP server that handles tool permission requests from Claude CLI:
- Automatically generates MCP configuration on server startup
- Provides `approval_prompt` tool for Claude to request permissions
- Tracks all permission requests through the PermissionTracker service
- Currently auto-approves all requests (future versions will support user approval/denial)

## Recent Major Features

### React-based Web UI with Vite Integration
- Modern React + TypeScript frontend replacing vanilla JavaScript
- Vite development server integration for hot module replacement
- Real-time conversation streaming with proper message rendering
- File system navigation with security boundaries
- Comprehensive error handling and status tracking
- Real-time log viewer with filtering and JSONL parsing

### Enhanced File System API
- Secure file system access with multiple security layers
- Path traversal prevention and validation
- Support for listing directories and reading files
- Binary file detection and size limits
- Optional base path restrictions for sandboxing

### MCP Permission System Integration
- Automatic MCP configuration generation on server startup
- Permission request tracking and broadcasting
- Integration with Claude CLI's `--permission-prompt-tool` flag
- Real-time permission event streaming to clients

## Recent Major Changes

### Zero-dependency JSON File Manager (commit 93e65ca)
- Migrated from lowdb to custom JsonFileManager implementation
- Zero external dependencies for file-based persistence
- Atomic write operations with file locking for data integrity
- Built-in backup and recovery mechanisms
- Maintains full compatibility with existing session-info.json format

### Comprehensive Configuration System
- Machine-specific configuration in `~/.ccui/config.json` for server settings
- Auto-generated machine IDs for unique instance identification
- Graceful configuration creation and validation on startup
- Log levels controlled via LOG_LEVEL environment variable (not in config file)

### Critical Streaming Race Condition Fix (commit 2440781)
- Fixed parent message race condition in streaming responses
- Ensures proper message ordering and parent-child relationships
- Prevents orphaned messages in conversation history
- Improved reliability of real-time conversation streaming


## Development Commands

```bash
# Development server with hot reloading (backend + integrated frontend on port 3001)
npm run dev

# Development server with separate Vite dev server (frontend on port 3000)
npm run dev:web

# Build everything (frontend + backend with path alias resolution)
npm run build

# Build React frontend for production only
npm run build:web

# Run the CLI after building
npm run cli

# Run all tests
npm test

# Run tests with debug logging
npm run test:debug

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run unit tests only
npm run unit-tests

# Run integration tests only
npm run integration-tests

# Lint TypeScript files
npm run lint

# Type check TypeScript files
npm run typecheck
```

> For CLI commands and testing details, see `src/cli/CLAUDE.md` and `tests/CLAUDE.md`

## Architecture Overview

### Core Components

The backend follows a service-oriented architecture with these key components:

- **CCUIServer** (`src/ccui-server.ts`) - Main Express server with vite-express integration for single-port architecture
- **ClaudeProcessManager** (`src/services/claude-process-manager.ts`) - Manages Claude CLI process lifecycle with MCP integration
- **StreamManager** (`src/services/stream-manager.ts`) - Handles client streaming connections via newline-delimited JSON (not SSE)
- **ClaudeHistoryReader** (`src/services/claude-history-reader.ts`) - Reads conversation history from ~/.claude and provides working directory lookup
- **ConversationStatusTracker** (`src/services/conversation-status-tracker.ts`) - Tracks conversation status based on active streams
- **JsonLinesParser** (`src/services/json-lines-parser.ts`) - Parses JSONL streams from Claude CLI
- **PermissionTracker** (`src/services/permission-tracker.ts`) - Tracks MCP permission requests from Claude
- **MCPConfigGenerator** (`src/services/mcp-config-generator.ts`) - Generates dynamic MCP configuration files
- **MCP Permission Server** (`src/mcp-server/index.ts`) - Standalone MCP server for handling permission requests
- **FileSystemService** (`src/services/file-system-service.ts`) - Secure file system access with validation and sandboxing
- **LogStreamBuffer** (`src/services/log-stream-buffer.ts`) - Circular buffer for capturing and streaming server logs
- **SessionInfoService** (`src/services/session-info-service.ts`) - Manages session metadata including custom names using JsonFileManager for fast local storage
- **JsonFileManager** (`src/services/json-file-manager.ts`) - Custom zero-dependency JSON file persistence with atomic writes and file locking

### Frontend Architecture

The React-based web UI provides the primary interface:

- **Single-Port Integration** - Both frontend and backend served on port 3001 via vite-express
- **Tool Rendering System** (`src/web/chat/components/ToolRendering/`) - Specialized components for rendering each tool type (Bash, Edit, Read, etc.)
- **Real-time Streaming** - Custom hooks for managing JSONL streams from backend
- **Message Management** - Immutable message handling with conversation-level streaming status
- **TUI-inspired Design** - CSS Modules with theme system and mobile responsiveness

> For detailed service architecture and implementation patterns, see `src/services/CLAUDE.md`
> For web UI architecture and component patterns, see `src/web/CLAUDE.md`

[... rest of the existing content remains unchanged ...]

## Memories and Notes

- Check Anthropic.Message | Anthropic.MessageParam implementation at node_modules/@anthropic-ai/sdk/src/resources/messages/messages.ts when working on rendering/parsing message outputs
- Use test:debug for trouble shooting
- The cc-worktrees/ is used for isolated working tree with git worktree. Create worktree there and cd into it when instructed to use worktree to implement feature
- If mcp are missing in real claude test/usage, it might be that we need to build and build:mcp to chmod mcp endpoiints
- Added details about the `config.json` in `~/.ccui`:
  - Location: `~/.ccui/config.json`
  - Automatically created on first server startup
  - Contains machine-specific configuration with auto-generated machine ID
  - Includes server and machine identification settings
  - Provides a centralized, file-based approach to configuration management
  - Log levels are controlled via LOG_LEVEL environment variable
- **Remember the correct mindset of message list handling**
  - **Simplified Message Handling**: 
    - ChatMessage no longer has isStreaming field - streaming is tracked only at conversation level
    - Message content is properly typed as `string | ContentBlock[]`
    - Messages are immutable once added (no update capability)
    - useConversationMessages only exposes `addMessage`, `clearMessages`, and `setAllMessages`
    - User streaming messages (tool_results) are dropped entirely, not added
    - Duplicate messages are dropped with console.log for debugging
  - **Important**: There is no auto-scroll feature in the UI
  - Streaming status is only tracked at the conversation level via ConversationStatusTracker
- **Logger Wrapper Implementation (CCUILogger)**:
  - Created `CCUILogger` wrapper class to provide intuitive API: `logger.method('message', context)`
  - Translates to Pino's expected format: `logger.method(context, 'message')`
  - Maintains backward compatibility for all 206+ logger calls across the codebase
  - Type alias `export type Logger = CCUILogger` ensures no type errors
  - Supports all log levels: debug, info, warn, error, fatal
  - Special handling for error method to support both `error('msg', err, context)` and `error('msg', context)` patterns
- **Cost tracking feature removed**: Legacy cost tracking fields have been removed from all interfaces and services as they were not being used

[... rest of the existing content remains unchanged ...]