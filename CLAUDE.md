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
Each conversation runs as a separate `claude` CLI child process with these characteristics:

```typescript
class ClaudeProcessManager {
  private processes: Map<string, ChildProcess> = new Map();
  private outputBuffers: Map<string, string> = new Map();
  
  async startConversation(config: ConversationConfig): Promise<string> {
    const sessionId = generateSessionId();
    
    // Build Claude CLI command with required flags
    const args = [
      '-p',                            // Print mode for programmatic use
      '--output-format', 'stream-json', // JSONL output format
      '--mcp-config', this.mcpConfigPath,
      '--permission-prompt-tool', 'mcp__ccui__permission_prompt',
      '--add-dir', config.workingDirectory,
      ...config.initialPrompt
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
- Parse JSONL output incrementally using custom `JsonLinesParser`
- Handle graceful shutdown with SIGTERM/SIGKILL fallback
- Automatic cleanup on process termination

### MCP Integration
Model Context Protocol integration enables permission handling:

```typescript
class CCUIMCPServer {
  private server: McpServer;
  private pendingRequests: Map<string, PermissionRequest> = new Map();
  
  constructor() {
    this.server = new McpServer({
      name: "ccui-permissions",
      version: "1.0.0"
    });
    
    // Register permission prompt tool
    this.server.tool("permission_prompt", {
      tool_name: z.string(),
      input: z.object({}).passthrough(),
      session_id: z.string()
    }, async ({ tool_name, input, session_id }) => {
      // Create permission request and wait for user decision
      const request = await this.createPermissionRequest(tool_name, input, session_id);
      const decision = await this.waitForDecision(request.id);
      
      return decision.approved ? 
        { content: [{ type: "text", text: JSON.stringify({ behavior: "allow", updatedInput: input }) }] } :
        { content: [{ type: "text", text: JSON.stringify({ behavior: "deny", message: "Permission denied" }) }] };
    });
  }
}
```

**Permission Flow:**
1. Claude requests tool usage via MCP
2. MCP server creates `PermissionRequest` object
3. Request streamed to web clients via HTTP streaming
4. User approves/denies via REST API
5. Decision returned to Claude for execution

### Streaming Architecture
HTTP streaming with newline-delimited JSON (not Server-Sent Events):

```typescript
class StreamManager {
  private clients: Map<string, Set<Response>> = new Map();
  
  addClient(sessionId: string, res: Response) {
    // Configure for streaming
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    // Add to client set for broadcasting
    if (!this.clients.has(sessionId)) {
      this.clients.set(sessionId, new Set());
    }
    this.clients.get(sessionId)!.add(res);
    
    // Send connection confirmation
    this.sendToClient(res, {
      type: 'connected',
      session_id: sessionId,
      timestamp: new Date().toISOString()
    });
  }
  
  broadcast(sessionId: string, event: StreamUpdate) {
    const clients = this.clients.get(sessionId);
    if (!clients) return;
    
    for (const client of clients) {
      client.write(`${JSON.stringify(event)}\n`);
    }
  }
}
```

**Stream Features:**
- Multiple clients can watch the same conversation
- Real-time updates as Claude generates responses
- Automatic client cleanup on disconnect
- Connection confirmation and error handling

### JSONL Stream Parser
Custom Transform stream for parsing JSONL incrementally:

```typescript
class JsonLinesParser extends Transform {
  private buffer = '';
  
  _transform(chunk: Buffer, encoding: string, callback: Function) {
    this.buffer += chunk.toString();
    let lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const parsed = JSON.parse(line);
          this.push(parsed); // Emit parsed object
        } catch (error) {
          this.emit('error', new Error(`Invalid JSON: ${line}`));
        }
      }
    }
    callback();
  }
}
```

### History File Reader
Reads conversation history from Claude's local storage:

```typescript
class ClaudeHistoryReader {
  private claudeHomePath = path.join(os.homedir(), '.claude');
  
  async listConversations(): Promise<ConversationSummary[]> {
    const projectsPath = path.join(this.claudeHomePath, 'projects');
    const projects = await fs.readdir(projectsPath);
    
    for (const project of projects) {
      // Process each project directory
      const files = await fs.readdir(path.join(projectsPath, project));
      for (const file of files.filter(f => f.endsWith('.jsonl'))) {
        // Parse conversation files
        const sessionId = path.basename(file, '.jsonl');
        const summary = await this.parseConversationSummary(file);
        // ... build conversation list
      }
    }
  }
  
  private decodeProjectPath(encoded: string): string {
    // Claude encodes paths by replacing '/' with '-'
    return encoded.replace(/-/g, '/');
  }
}
```

### Error Handling
- Custom `CCUIError` class with error codes and HTTP status codes
- Graceful handling of process failures and cleanup
- Proper error propagation through Express middleware
- Comprehensive logging with Pino for debugging

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

#### CLI Flags Reference
The backend uses these Claude CLI flags for programmatic integration:

| Flag | Description | Example |
|------|-------------|---------|
| `-p, --print` | Print response and exit (useful for pipes) | `claude -p "query"` |
| `--output-format stream-json` | JSONL output format for parsing | `claude -p "query" --output-format stream-json` |
| `--input-format stream-json` | Realtime streaming input format | `claude --input-format stream-json` |
| `--mcp-config` | Load MCP servers from JSON file or string | `claude --mcp-config ./config/mcp-config.json` |
| `--add-dir` | Grant directory access (absolute paths) | `claude --add-dir /path/to/project` |
| `--model` | Specify model version | `claude --model claude-sonnet-4-20250514` |
| `--allowedTools` | Pre-approved tools (comma/space separated) | `claude --allowedTools "Bash,Read,Write"` |
| `--disallowedTools` | Blocked tools (comma/space separated) | `claude --disallowedTools "Bash(rm)"` |
| `--dangerously-skip-permissions` | Bypass all permission checks | `claude --dangerously-skip-permissions` |
| `--verbose` | Enable verbose mode | `claude --verbose` |
| `-d, --debug` | Enable debug mode | `claude --debug` |
| `-c, --continue` | Continue most recent conversation | `claude --continue` |
| `-r, --resume` | Resume a conversation by session ID | `claude --resume session-id` |

#### Additional CLI Commands
```bash
# Configuration management
claude config                    # Manage configuration settings
claude config set -g theme dark  # Set global theme to dark

# MCP server management  
claude mcp                       # Configure and manage MCP servers

# System maintenance
claude doctor                    # Check Claude Code health
claude update                    # Check for and install updates
claude migrate-installer         # Migrate from npm to local installation

# Get version and help
claude --version                 # Show version number
claude --help                   # Display help information
```

#### Stream JSON Output Format
When using `--output-format stream-json`, Claude outputs newline-delimited JSON messages:

```json
{"type":"system","subtype":"init","cwd":"/path","session_id":"abc123","tools":["Bash","Read"],"mcp_servers":[],"model":"claude-sonnet-4-20250514","permissionMode":"default","apiKeySource":"environment"}
{"type":"assistant","message":{"id":"msg_123","content":[{"type":"text","text":"Hello!"}],"role":"assistant","model":"claude-sonnet-4-20250514","stop_reason":"end_turn","usage":{"input_tokens":10,"output_tokens":5}},"session_id":"abc123"}
{"type":"result","subtype":"success","cost_usd":0.003,"is_error":false,"duration_ms":1500,"num_turns":2,"total_cost":0.003,"usage":{"input_tokens":45,"output_tokens":25},"session_id":"abc123"}
```

#### Claude Data Directory Structure
Claude stores conversation history in `~/.claude/` with this structure:

```
~/.claude/
├── projects/                    # Conversations grouped by working directory
│   ├── -Users-username-project/ # Encoded directory path
│   │   ├── session-id-1.jsonl   # Individual conversation files
│   │   └── session-id-2.jsonl
│   └── -home-user-another/
├── settings.json                # User preferences and tool permissions
└── ...
```

Each `.jsonl` file contains:
- First line: Summary metadata (`{"type":"summary","summary":"...","leafUuid":"..."}`)
- Subsequent lines: Conversation messages with full tool usage details

### Debugging
- Check server logs for process spawn failures
- Verify Claude CLI is properly installed (`claude --version`)
- Ensure MCP configuration file is valid JSON
- Monitor process lifecycle through `ClaudeProcessManager` events

## Implementation Flows

### Starting a Conversation
```
1. Frontend calls POST /api/conversations/start
2. Backend spawns Claude CLI process with MCP config:
   claude -p --output-format stream-json --mcp-config ./config/mcp-config.json 
   --permission-prompt-tool mcp__ccui__permission_prompt --add-dir /path/to/project "prompt"
3. Backend returns session ID and stream URL
4. Frontend connects to GET /api/stream/:sessionId
5. Claude output is parsed and streamed to frontend in real-time
```

### Permission Handling Flow
```
1. Claude invokes a tool requiring permission
2. MCP server receives the tool request via permission_prompt tool
3. MCP server creates pending PermissionRequest object
4. Backend broadcasts permission request via HTTP stream
5. Frontend displays permission UI to user
6. User approves/denies via POST /api/permissions/:id
7. MCP server returns decision to Claude
8. Claude continues or stops based on decision
```

### History Browsing
```
1. Frontend calls GET /api/conversations
2. Backend reads ~/.claude/projects directory structure
3. Backend parses .jsonl files for conversation summaries
4. Returns paginated conversation list with metadata
5. Frontend can fetch full conversation via GET /api/conversations/:id
6. Backend parses complete .jsonl file and returns message history
```

## Example Usage

### Conversation Lifecycle
```typescript
// Start conversation
const response = await fetch('/api/conversations/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workingDirectory: '/home/user/project',
    initialPrompt: 'List files in the current directory',
    model: 'claude-sonnet-4-20250514'
  })
});
const { sessionId, streamUrl } = await response.json();

// Connect to stream
const stream = await fetch(streamUrl);
const reader = stream.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const lines = decoder.decode(value).split('\n');
  for (const line of lines) {
    if (line.trim()) {
      const message = JSON.parse(line);
      console.log('Stream message:', message);
    }
  }
}
```

### Permission Handling
```typescript
// Listen for permission requests in stream
if (message.type === 'permission_request') {
  const { id, toolName, toolInput } = message.data;
  
  // Show UI to user, then send decision
  const decision = await showPermissionDialog(toolName, toolInput);
  
  await fetch(`/api/permissions/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: decision ? 'approve' : 'deny',
      modifiedInput: decision ? toolInput : undefined
    })
  });
}
```

## API Documentation

The backend provides REST endpoints for:
- **Conversation Management** - Start, list, continue, and stop conversations
- **Streaming** - Real-time updates via HTTP streaming
- **Permissions** - Handle MCP permission requests
- **System** - Status and model information

## API Specification

### REST API Endpoints

#### Conversation Management

```typescript
// Start new conversation
POST /api/conversations/start
Request: {
  workingDirectory: string;    // Absolute path where Claude should operate
  initialPrompt: string;       // First message to send to Claude
  model?: string;              // Optional: specific model version (e.g., 'opus', 'sonnet')
  allowedTools?: string[];     // Optional: whitelist of tools Claude can use without asking
  disallowedTools?: string[];  // Optional: blacklist of tools Claude cannot use
  systemPrompt?: string;       // Optional: override default system prompt
}
Response: {
  sessionId: string;           // Unique identifier for this conversation
  streamUrl: string;           // Streaming endpoint to receive real-time updates
}

// List all conversations
GET /api/conversations
Query: {
  projectPath?: string;        // Filter by working directory
  limit?: number;              // Max results per page (default: 20)
  offset?: number;             // Skip N results for pagination
  sortBy?: 'created' | 'updated';  // Sort field
  order?: 'asc' | 'desc';      // Sort direction
}
Response: {
  conversations: ConversationSummary[];  // Array of conversation metadata
  total: number;               // Total count for pagination
}

// Get conversation details
GET /api/conversations/:sessionId
Response: {
  messages: ConversationMessage[];  // Complete message history
  summary: string;             // Conversation summary
  projectPath: string;         // Working directory
  metadata: {
    totalCost: number;         // Sum of all message costs
    totalDuration: number;     // Total processing time
    model: string;             // Model used for conversation
  };
}

// Continue conversation
POST /api/conversations/:sessionId/continue
Request: {
  prompt: string;              // New message to send to Claude
}
Response: {
  streamUrl: string;           // Same streaming endpoint as before
}

// Stop active conversation
POST /api/conversations/:sessionId/stop
Response: {
  success: boolean;            // Whether process was successfully terminated
}
```

#### Streaming Endpoint

```typescript
// Stream conversation updates
GET /api/stream/:sessionId
Response: Newline-delimited JSON stream

// Stream message types include:
interface SystemInitMessage {
  type: 'system';
  subtype: 'init';
  cwd: string;
  tools: string[];
  mcp_servers: { name: string; status: string; }[];
  model: string;
  permissionMode: string;
  apiKeySource: string;
  session_id: string;
}

interface AssistantStreamMessage {
  type: 'assistant';
  message: Message; // Full Anthropic Message type
  session_id: string;
}

interface UserStreamMessage {
  type: 'user';
  message: MessageParam; // Anthropic MessageParam type
  session_id: string;
}

interface ResultStreamMessage {
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
  session_id: string;
}
```

#### Permission Management

```typescript
// List pending permissions
GET /api/permissions
Query: {
  sessionId?: string;          // Filter by conversation
  status?: 'pending' | 'approved' | 'denied';  // Filter by status
}
Response: {
  permissions: PermissionRequest[];  // Array of permission requests
}

// Approve/Deny permission
POST /api/permissions/:requestId
Request: {
  action: 'approve' | 'deny';  // User's decision
  modifiedInput?: any;         // Optional: user can modify tool parameters before approval
}
Response: {
  success: boolean;            // Whether decision was recorded
}
```

#### System Management

```typescript
// Get Claude installation info
GET /api/system/status
Response: {
  claudeVersion: string;       // Version of Claude CLI installed
  claudePath: string;          // Location of Claude executable
  configPath: string;          // Location of Claude config directory
  activeConversations: number; // Number of running Claude processes
}

// Get available models
GET /api/models
Response: {
  models: string[];            // Array of model identifiers
  defaultModel: string;        // Which model is used by default
}
```

### Data Types

```typescript
interface ConversationSummary {
  sessionId: string;        // Unique identifier for the conversation (UUID format)
  projectPath: string;      // Original working directory where conversation started
  summary: string;          // Brief description of the conversation
  createdAt: string;        // ISO 8601 timestamp when conversation file was created
  updatedAt: string;        // ISO 8601 timestamp of last modification
  messageCount: number;     // Total number of messages in the conversation
}

interface ConversationMessage {
  uuid: string;             // Unique identifier for this specific message
  type: 'user' | 'assistant' | 'system';  // Who sent the message
  message: any;             // Anthropic Message or MessageParam type
  timestamp: string;        // ISO 8601 timestamp when message was created
  sessionId: string;        // Links message to parent conversation
  parentUuid?: string;      // For threading - references previous message in chain
  costUSD?: number;         // API cost for this message (assistant messages only)
  durationMs?: number;      // Time taken to generate response (assistant messages only)
}

interface PermissionRequest {
  id: string;               // Unique request identifier
  sessionId: string;        // Which conversation triggered this request
  toolName: string;         // Name of the tool Claude wants to use
  toolInput: any;           // Parameters Claude wants to pass to the tool
  timestamp: string;        // When permission was requested
  status: 'pending' | 'approved' | 'denied';  // Current state of the request
}
```