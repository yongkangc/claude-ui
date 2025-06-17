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
2. **Backend** spawns Claude CLI processes independently
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
Each conversation runs as a separate `claude` CLI child process with these characteristics:

```typescript
class ClaudeProcessManager {
  private processes: Map<string, ChildProcess> = new Map();
  private outputBuffers: Map<string, string> = new Map();
  
  constructor() {
    super();
  }
  
  async startConversation(config: ConversationConfig): Promise<string> {
    const sessionId = generateSessionId();
    
    // Build Claude CLI command with required flags
    const args = [
      '-p',                            // Print mode for programmatic use
      config.initialPrompt,            // Initial prompt immediately after -p
      '--output-format', 'stream-json', // JSONL output format
      '--add-dir', config.workingDirectory
    ];
    
    const process = spawn('claude', args, {
      cwd: config.workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    this.processes.set(sessionId, process);
    this.setupProcessHandlers(sessionId, process);
    return sessionId;
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

**MCP Integration:** ClaudeProcessManager is now MCP-agnostic. MCP functionality is handled separately by the CCUIMCPServer component.

### MCP Integration (Isolated Component)
We keep isolated MCP implementation as we are going to implement them in the future. This means the MCP integration will be a separate, standalone component that can be developed and integrated modularly.

The rest of the architectural details and code remain the same as in the previous documentation. The key point is that the MCP implementation will be kept isolated to allow for future flexible development.

## Code Practices and Guidelines

- **Testing Guideline:** Avoid create mocks when testing. Always use real service/code unless it's very unconvenient

[Rest of the documentation remains unchanged]