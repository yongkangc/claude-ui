# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code, cc in short) when working with code in this repository.

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

# Run integration tests only
npm run integration-tests

# Lint TypeScript files
npm run lint
```

### CLI Commands

The project includes a CLI interface built with Commander.js:

```bash
# Start the CCUI backend server
ccui serve --port 3001

# List all conversations
ccui list --project /path/to/project --limit 20 --json

# Get conversation details
ccui get <sessionId> --json

# Get system status
ccui status --json

# Resume an existing conversation
ccui resume <sessionId> <message> --json --debug
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
- **ClaudeHistoryReader** (`src/services/claude-history-reader.ts`) - Reads conversation history from ~/.claude and provides working directory lookup
- **ConversationStatusTracker** (`src/services/conversation-status-tracker.ts`) - Tracks conversation status based on active streams
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

## Core Type Definitions

### Stream Message Types

Those are only presented at from the streaming output of cc. See cc-workfiles/knowledge/example-cc-stream-json.md to understand the structure of the streaming output.

```typescript
// Claude CLI stream messages - these come from the Claude CLI process
// Return at the start of streaming immediately.
export interface SystemInitMessage {
  type: 'system';
  subtype: 'init';
  cwd: string;
  session_id: string;           // Claude CLI's session ID
  tools: string[];
  mcp_servers: Array<{ name: string; status: string; }>;
  model: string;
  permissionMode: string;
  apiKeySource: string;
}

export interface AssistantStreamMessage {
  type: 'assistant';
  message: {
    id: string;
    content: Array<ContentBlock>;
    role: 'assistant';
    model: string;
    stop_reason: StopReason | null;
    stop_sequence: string | null;
    usage: Usage;
  };
  parent_tool_use_id: string | null;
  session_id: string;           // Claude CLI's session ID
}

export interface UserStreamMessage {
  type: 'user';
  message: {
    role: 'user';
    content: Array<ContentBlockParam>;
  };
  parent_tool_use_id: string | null;
  session_id: string;           // Claude CLI's session ID
}

// Only appear when the streaming is completed.
export interface ResultStreamMessage {
  type: 'result';
  subtype: 'success' | 'error_max_turns';
  cost_usd: number;
  is_error: boolean;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  result?: string;
  total_cost: number;
  usage: {
    input_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
    output_tokens: number;
    server_tool_use: {
      web_search_requests: number;
    };
  };
  session_id: string;           // Claude CLI's session ID
}
```

### Content Block System

```typescript
// Core content types from Anthropic SDK
export type ContentBlock =
  | TextBlock
  | ToolUseBlock
  | ServerToolUseBlock
  | WebSearchToolResultBlock
  | ThinkingBlock
  | RedactedThinkingBlock;

export interface TextBlock {
  type: 'text';
  text: string;
  citations?: Array<TextCitation> | null;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
  signature: string;
}

export interface RedactedThinkingBlock {
  type: 'redacted_thinking';
  data: string;
}

export interface ServerToolUseBlock {
  type: 'server_tool_use';
  id: string;
  name: 'web_search';
  input: unknown;
}

export interface ToolResultBlockParam {
  tool_use_id: string;
  type: 'tool_result';
  content: string | Array<TextBlockParam | ImageBlockParam>;
  is_error?: boolean;
}

export type StopReason = 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | 'pause_turn' | 'refusal';
```

### API Request/Response Types

```typescript
export interface StartConversationRequest {
  workingDirectory: string;
  initialPrompt: string;
  model?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  systemPrompt?: string;
}

// Resume conversation also return this.
export interface StartConversationResponse {
  streamingId: string;          // CCUI's internal streaming identifier
  streamUrl: string;            // e.g., "/api/stream/abc123-def456"
}

export interface ResumeConversationRequest {
  sessionId: string;            // Claude CLI's session ID from history
  message: string;              // New message to continue conversation
}

export interface ConversationSummary {
  sessionId: string;            // Claude CLI's actual session ID
  projectPath: string;          // Original working directory
  summary: string;              // Brief description
  createdAt: string;            // ISO 8601 timestamp
  updatedAt: string;            // ISO 8601 timestamp
  messageCount: number;         // Total message count
  totalCost: number;            // Sum of all message costs
  totalDuration: number;        // Total processing time
  model: string;                // Model used for conversation
  status: 'completed' | 'ongoing' | 'pending';
  streamingId?: string;         // Only present when status is 'ongoing'
}

export interface ConversationMessage {
  uuid: string;                 // Unique identifier for message
  type: 'user' | 'assistant' | 'system';
  message: Message | MessageParam;
  timestamp: string;            // ISO 8601 timestamp
  sessionId: string;            // Claude CLI's session ID
  parentUuid?: string;          // For threading
  isSidechain?: boolean;        // Whether part of sidechain conversation
  userType?: string;            // e.g., 'external'
  cwd?: string;                 // Working directory when created
  version?: string;             // Claude CLI version
  costUSD?: number;             // API cost (assistant messages only)
  durationMs?: number;          // Generation time (assistant messages only)
}
```

### Configuration Types

```typescript

// This is used for start conversation endpoint
export interface ConversationConfig {
  workingDirectory: string;
  initialPrompt: string;
  model?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  systemPrompt?: string;
  claudeExecutablePath?: string;
}
```

### Stream Event Types

```typescript
// CCUI internal stream events
export type StreamEvent = 
  | { type: 'connected'; streaming_id: string; timestamp: string }
  | { type: 'permission_request'; data: PermissionRequest; streamingId: string; timestamp: string } // This is used for MCP permission request, not implemented yet.
  | { type: 'error'; error: string; streamingId: string; timestamp: string }
  | { type: 'closed'; streamingId: string; timestamp: string }
  | SystemInitMessage
  | AssistantStreamMessage
  | UserStreamMessage
  | ResultStreamMessage;
```

### Tool Definitions and Patterns

```typescript
// Common tool usage patterns from Claude Code
interface FileOperationTools {
  Read: { 
    file_path: string; 
    offset?: number; 
    limit?: number; 
  };
  Edit: { 
    file_path: string; 
    old_string: string; 
    new_string: string; 
    replace_all?: boolean; 
  };
  Write: { 
    file_path: string; 
    content: string; 
  };
  MultiEdit: { 
    file_path: string; 
    edits: Array<{
      old_string: string; 
      new_string: string; 
      replace_all?: boolean;
    }>; 
  };
}

interface SearchTools {
  Grep: { 
    pattern: string; 
    path?: string; 
    include?: string; 
  };
  Glob: { 
    pattern: string; 
    path?: string; 
  };
  LS: { 
    path: string; 
    ignore?: string[]; 
  };
}

interface ExecutionTools {
  Bash: { 
    command: string; 
    description?: string; 
    timeout?: number; 
  };
}

interface TaskManagement {
  TodoRead: {};
  TodoWrite: { 
    todos: Array<{ 
      id: string; 
      content: string; 
      status: 'pending' | 'in_progress' | 'completed'; 
      priority: 'high' | 'medium' | 'low'; 
    }>; 
  };
}

interface WebTools {
  WebSearch: { 
    query: string; 
    allowed_domains?: string[]; 
    blocked_domains?: string[]; 
  };
  WebFetch: { 
    url: string; 
    prompt: string; 
  };
}

interface AgentTools {
  Task: {
    description: string;        // 3-5 word task description
    prompt: string;             // Detailed task instructions
  };
}
```

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
├── __mocks__
│   └── claude
├── integration
│   ├── conversation-status-integration.test.ts
│   ├── real-claude-integration.test.ts
│   └── streaming-integration.test.ts
├── setup.ts
├── unit
│   ├── ccui-server.test.ts
│   ├── claude-history-reader.test.ts
│   ├── claude-process-long-running.test.ts
│   ├── claude-process-manager.test.ts
│   ├── cli
│   │   ├── get.test.ts
│   │   ├── list.test.ts
│   │   ├── serve.test.ts
│   │   ├── status-simple.test.ts
│   │   ├── status-working.test.ts
│   │   └── status.test.ts
│   ├── conversation-status-tracker.test.ts
│   ├── json-lines-parser.test.ts
│   └── stream-manager.test.ts
└── utils
    └── test-helpers.ts
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

Resume existing conversations using Claude CLI's `--resume` functionality via API or CLI:

**API Usage:**
```json
POST /api/conversations/resume
{
  "sessionId": "claude-session-id",
  "message": "Continue with this message"
}
```

**CLI Usage:**
```bash
ccui resume <sessionId> <message> [--json] [--debug] [--server-port <port>]
```

Returns new streaming ID for continued conversation. Session parameters (model, working directory, etc.) are inherited from original conversation. The CLI command provides real-time streaming output and supports both human-readable and JSON output formats.

### Conversation Status Tracking

The backend automatically tracks conversation status based on active streaming connections:

**Status Values:**
- `completed`: Conversation has finished and no active stream exists (default)
- `ongoing`: Conversation has an active streaming connection (currently being processed)
- `pending`: Reserved for future features (not currently used)

**Implementation:**
```typescript
class ConversationStatusTracker {
  // Maps Claude session ID -> CCUI streaming ID
  private sessionToStreaming: Map<string, string> = new Map();
  
  // Maps CCUI streaming ID -> Claude session ID (reverse lookup)
  private streamingToSession: Map<string, string> = new Map();
  
  registerActiveSession(streamingId: string, claudeSessionId: string): void
  unregisterActiveSession(streamingId: string): void
  getConversationStatus(claudeSessionId: string): 'completed' | 'ongoing' | 'pending'
}
```

**Integration:**
- Session IDs are extracted from stream messages and registered automatically
- Status is updated in real-time when streams start/end
- Conversation list endpoint includes current status for each conversation
- **Streaming ID field**: Ongoing conversations include an optional `streamingId` field in API responses that provides the CCUI internal streaming identifier for connecting to active streams or stopping conversations
- Status tracking handles process errors and cleanup gracefully
- Rich metadata support including conversation summaries, message counts, and cost tracking

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

## CC Patterns

### Command Construction Examples

```bash
# Basic patterns
claude -p "query" --output-format stream-json --verbose
claude -p "query" --model claude-opus-4-20250514 --max-turns 5
claude --resume <session-id> "continue message"
claude --continue  # Continue most recent conversation

# Tool control patterns
claude -p "query" --allowedTools "Bash,Read,Write,Edit"
claude -p "query" --disallowedTools "Bash(git:*),WebSearch"
claude -p "query" --allowedTools "mcp__filesystem__read_file"

# Directory and context
claude -p "query" --add-dir /additional/path --add-dir /another/path
```

### Conversation History Structure

The `~/.claude` directory follows this pattern:
```
~/.claude/
├── projects/
│   └── {encoded-working-directory}/
│       └── {session-id}.jsonl
├── settings.json
├── statsig/
└── todos/
```

### Testing Patterns

```typescript
// Integration test pattern with mock Claude CLI
function getMockClaudeExecutablePath(): string {
  return path.join(process.cwd(), 'tests', '__mocks__', 'claude');
}

// Server setup with random port to avoid conflicts
const serverPort = 9000 + Math.floor(Math.random() * 1000);
const server = new CCUIServer({ port: serverPort });

// Override ProcessManager with mock path
const mockClaudePath = getMockClaudeExecutablePath();
const { ClaudeProcessManager } = await import('@/services/claude-process-manager');
(server as any).processManager = new ClaudeProcessManager(mockClaudePath);
```

### Service Method Signatures

```typescript
// ClaudeProcessManager key methods
class ClaudeProcessManager {
  async startConversation(config: ConversationConfig): Promise<string>
  async resumeConversation(sessionId: string, message: string): Promise<string>
  async stopConversation(streamingId: string): Promise<boolean>
  getActiveConversations(): Map<string, ChildProcess>
}

// StreamManager key methods
class StreamManager {
  addClient(streamingId: string, response: Response): void
  removeClient(streamingId: string, response: Response): void
  broadcast(streamingId: string, event: StreamEvent): void
  getClientCount(streamingId: string): number
}

// ClaudeHistoryReader key methods
class ClaudeHistoryReader {
  async getAllConversations(query?: ConversationListQuery): Promise<ConversationSummary[]>
  async getConversationDetails(sessionId: string): Promise<ConversationDetailsResponse>
  async getConversationWorkingDirectory(sessionId: string): Promise<string | null>
}

// ConversationStatusTracker key methods
class ConversationStatusTracker {
  registerActiveSession(streamingId: string, claudeSessionId: string): void
  unregisterActiveSession(streamingId: string): void
  getConversationStatus(claudeSessionId: string): 'completed' | 'ongoing' | 'pending'
  getStreamingIdForSession(claudeSessionId: string): string | undefined
}
```

### Error Handling Patterns

```typescript
// Custom error class
export class CCUIError extends Error {
  constructor(public code: string, message: string, public statusCode: number = 500) {
    super(message);
    this.name = 'CCUIError';
  }
}

// Common error codes
const ERROR_CODES = {
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  PROCESS_START_FAILED: 'PROCESS_START_FAILED',
  SYSTEM_STATUS_ERROR: 'SYSTEM_STATUS_ERROR',
  MODELS_ERROR: 'MODELS_ERROR',
  PERMISSION_REQUEST_NOT_FOUND: 'PERMISSION_REQUEST_NOT_FOUND'
};

// Error response format
interface ErrorResponse {
  error: string;               // Human-readable error message
  code?: string;               // Machine-readable error code
}
```

### Session ID Architecture

CCUI maintains **two separate session ID systems**:

1. **CCUI Streaming ID** (`streamingId`): Internal UUID for managing active processes and streaming connections
2. **Claude CLI Session ID** (`session_id`): Claude's internal session tracking, used in history files

```typescript
// API flow example
const startResponse = await fetch('/api/conversations/start', { ... });
const { streamingId, streamUrl } = await startResponse.json();
// streamingId: CCUI's internal ID (e.g., "a1b2c3d4-e5f6-7890-abcd-ef1234567890")

// In stream messages
const streamMessage = JSON.parse(streamLine);
const claudeSessionId = streamMessage.session_id;
// claudeSessionId: Claude CLI's session ID (used for history files)

// Resume using Claude's session ID
const resumeResponse = await fetch('/api/conversations/resume', {
  method: 'POST',
  body: JSON.stringify({
    sessionId: claudeSessionId,  // From conversation history
    message: 'Continue this conversation'
  })
});
```

## Important Notes

- **Logging**: Always use `@/services/logger.ts` for logging. NEVER USE CONSOLE.LOG in production code
- **API Documentation**: Update `@cc-workfiles/knowledge/API.md` after altering API endpoints
- **Claude CLI Streaming**: See `@cc-workfiles/knowledge/example-cc-stream-json.md` to understand raw JSONL output format
- **Integration Testing**: See `@cc-workfiles/knowledge/cc-with-fake-home-example.txt` for Claude CLI behavior with fake home directories
- **Claude Home Structure**: See `@cc-workfiles/knowledge/example-cc-config-folder.md` for `.claude` directory structure
- **Process Independence**: Each conversation runs as a separate Claude CLI child process