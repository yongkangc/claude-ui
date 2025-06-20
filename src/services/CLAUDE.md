# Services Architecture

This directory contains the core business logic services for CCUI backend.

## Service Overview

- **ClaudeProcessManager** (`claude-process-manager.ts`) - Manages Claude CLI process lifecycle
- **StreamManager** (`stream-manager.ts`) - Handles client streaming connections  
- **ClaudeHistoryReader** (`claude-history-reader.ts`) - Reads conversation history from ~/.claude and provides working directory lookup
- **ConversationStatusTracker** (`conversation-status-tracker.ts`) - Tracks conversation status based on active streams
- **JsonLinesParser** (`json-lines-parser.ts`) - Parses JSONL streams from Claude CLI

## Claude Process Management

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

## Service Method Signatures

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

## Conversation Status Tracking

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

## Data Flow Architecture

1. **Frontend** makes REST API calls to start/manage conversations
2. **Backend** spawns Claude CLI processes independently
3. **Claude CLI** outputs JSONL streams that are parsed and forwarded
4. **JsonLinesParser** transforms Claude output into structured events
5. **StreamManager** provides real-time updates to connected web clients via HTTP streaming

## Session ID Architecture

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

## Error Handling Patterns

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

## Important Notes

- **Logging**: Always use `@/services/logger.ts` for logging. NEVER USE CONSOLE.LOG in production code
- **Process Independence**: Each conversation runs as a separate Claude CLI child process
- **Event-driven architecture** using Node.js EventEmitter
- **Stateless design** for scalability