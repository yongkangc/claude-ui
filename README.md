# CCUI Backend

Backend server for the Claude Code Web UI (CCUI) project.

## Overview

This backend provides a REST API and WebSocket streaming interface to interact with Claude CLI processes. It enables web-based management of Claude conversations, permission handling, and real-time streaming of Claude responses.

The project now includes a modern React-based web interface with TUI-inspired design for interacting with Claude through a browser.

## Architecture

- **Express.js** server with TypeScript
- **React** frontend integrated with vite-express
- **Claude Process Management** - Spawns and manages Claude CLI processes
- **Streaming Communication** - Real-time updates via newline-delimited JSON streams
- **MCP Integration** - Model Context Protocol for permission handling
- **History Management** - Reads Claude conversation history from local files
- **Single-port architecture** - Frontend and backend served on the same port

## Key Components

- `ClaudeProcessManager` - Manages Claude CLI process lifecycle
- `StreamManager` - Handles client streaming connections
- `ClaudeHistoryReader` - Reads conversation history from ~/.claude
- `CCUIMCPServer` - MCP server for permission requests
- `JsonLinesParser` - Parses JSONL streams from Claude CLI

## API Endpoints

### Conversation Management
- `POST /api/conversations/start` - Start new conversation
- `GET /api/conversations` - List conversations
- `GET /api/conversations/:id` - Get conversation details
- `POST /api/conversations/:id/continue` - Continue conversation
- `POST /api/conversations/:id/stop` - Stop conversation

### Streaming
- `GET /api/stream/:sessionId` - Stream conversation updates

### Permissions
- `GET /api/permissions` - List pending permissions
- `POST /api/permissions/:id` - Approve/deny permission

### System
- `GET /api/system/status` - System status
- `GET /api/models` - Available models

### Preferences
- `GET /api/preferences` - Get user preferences
- `PUT /api/preferences` - Update user preferences

## Installation

```bash
npm install
```

## Web UI

The project includes an integrated React-based web interface with TUI-inspired design.

### Features
- Real-time conversation streaming
- Conversation history and management
- Mobile-responsive TUI-inspired design
- JSON syntax highlighting for message content
- Single-port architecture using vite-express

### Development

```bash
# Install dependencies
npm install

# Start development server (default port 3001)
npm run dev

# Start on a different port
npm run dev -- --port 3002

# Start on a different host
npm run dev -- --host 0.0.0.0

# Using environment variables
CCUI_PORT=3002 npm run dev
CCUI_HOST=0.0.0.0 CCUI_PORT=3002 npm run dev
```

Access the UI at `http://localhost:3001` (or your configured port) - both backend API and frontend are served on the same port.

### Production

```bash
# Build everything (web UI + backend)
npm run build

# Run in production mode
NODE_ENV=production npm start
```

The server automatically serves the optimized web UI at `http://localhost:3001`.

## Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Configuration

CCUI uses a configuration file at `~/.ccui/config.json` for server settings. The file is automatically created on first startup.
User preferences are stored separately in `~/.ccui/preferences.json`. Currently this file tracks the UI color scheme and language.

### Logging Configuration

Set the log level using the `LOG_LEVEL` environment variable:

```bash
# Run with debug logging
LOG_LEVEL=debug npm run dev

# Run with info logging (default)
LOG_LEVEL=info npm run dev

# Available levels: silent, error, warn, info, debug
```

Alternatively, use the CLI flag:

```bash
ccui serve --log-level debug
```

## Testing

The project includes comprehensive test coverage:

- Unit tests for all service classes
- Integration tests for API endpoints
- Integration tests for streaming functionality
- Integration tests for MCP permission flow

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## MCP Configuration

The MCP (Model Context Protocol) configuration allows Claude to request permissions for tool usage. Configure MCP servers in `config/mcp-config.json`.

## Architecture Notes

### Process Management
- Each conversation runs as a separate Claude CLI process
- Processes are managed via Node.js child_process.spawn()
- Output is parsed as JSONL (newline-delimited JSON)

### Streaming
- Uses HTTP streaming with newline-delimited JSON
- Not Server-Sent Events (SSE) - each line is a complete JSON object
- Supports multiple clients per conversation session

### Permission Handling
- MCP server intercepts tool permission requests
- Requests are streamed to connected clients
- User decisions are sent back through REST API
- Approved/denied responses are returned to Claude

## Development Status

This is currently a **stub implementation** with comprehensive test coverage. Key areas that need implementation:

1. **ClaudeProcessManager**: 
   - `buildClaudeArgs()` - Build CLI arguments
   - `spawnClaudeProcess()` - Spawn process with proper configuration
   - `setupProcessHandlers()` - Handle stdout/stderr streams

2. **ClaudeHistoryReader**:
   - `readProjectConversations()` - Parse project directories
   - `findConversationFile()` - Locate conversation files
   - `parseMessage()` - Parse JSONL entries
   - `getConversationMetadata()` - Extract metadata

3. **Error Handling**: Custom error types and proper HTTP status codes

4. **Security**: Input validation, rate limiting, authentication

## Contributing

1. Follow existing code patterns and TypeScript conventions
2. Maintain test coverage above 90%
3. All new features should include tests
4. Use the existing error handling patterns

## License

[License information]