# CCUI Backend

Backend server for the Claude Code Web UI (CCUI) project.

## Overview

This backend provides a REST API and WebSocket streaming interface to interact with Claude CLI processes. It enables web-based management of Claude conversations, permission handling, and real-time streaming of Claude responses.

## Architecture

- **Express.js** server with TypeScript
- **Claude Process Management** - Spawns and manages Claude CLI processes
- **Streaming Communication** - Real-time updates via newline-delimited JSON streams
- **MCP Integration** - Model Context Protocol for permission handling
- **History Management** - Reads Claude conversation history from local files

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

## Installation

```bash
npm install
```

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

Copy `.env.example` to `.env` and configure:

```bash
PORT=3001
CLAUDE_HOME_PATH=~/.claude
MCP_CONFIG_PATH=./config/mcp-config.json
LOG_LEVEL=info
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