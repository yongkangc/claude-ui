# CCUI Backend API Documentation

## Table of Contents

1. [Overview](#overview)
2. [Base URL and Configuration](#base-url-and-configuration)
3. [API Endpoints](#api-endpoints)
4. [Real-Time Streaming](#real-time-streaming)
5. [TypeScript Types](#typescript-types)
6. [Error Handling](#error-handling)
7. [Frontend Integration Patterns](#frontend-integration-patterns)

## Overview

CCUI (Claude Code Web UI) is a backend server that provides a web interface for managing Claude CLI processes. The backend offers REST APIs for conversation management, real-time streaming for Claude interactions, and permission handling through the Model Context Protocol (MCP).

### Architecture

```
Frontend (Browser) ──► CCUI Backend ──► Claude CLI Process
        │                     │                │
        │                     ▼                │
        └──────────────► MCP Server ◄──────────┘
                    (Permission Handling)
```

## Base URL and Configuration

**Default Base URL:** `http://localhost:3001`

**Environment Variables:**
- `PORT`: Server port (default: 3001)
- `CLAUDE_HOME_PATH`: Claude data directory (default: ~/.claude)
- `MCP_CONFIG_PATH`: MCP configuration file path
- `LOG_LEVEL`: Logging level (debug, info, warn, error)

## API Endpoints

### Health Check

#### `GET /health`

Check if the server is running.

**Response:**
```json
{
  "status": "ok"
}
```

### Conversation Management

#### `POST /api/conversations/start`

Start a new conversation with Claude.

**Request Body:**
```typescript
interface StartConversationRequest {
  workingDirectory: string;    // Absolute path where Claude should operate
  initialPrompt: string;       // First message to send to Claude
  model?: string;              // Optional: specific model version (e.g., 'opus', 'sonnet')
  allowedTools?: string[];     // Optional: whitelist of tools Claude can use without asking
  disallowedTools?: string[];  // Optional: blacklist of tools Claude cannot use
  systemPrompt?: string;       // Optional: override default system prompt
}
```

**Example Request:**
```javascript
const response = await fetch('/api/conversations/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workingDirectory: '/home/user/project',
    initialPrompt: 'List files in the current directory',
    model: 'claude-opus-4-20250514'
  })
});
```

**Response:**
```typescript
interface StartConversationResponse {
  streamingId: string;         // CCUI's internal streaming identifier
  streamUrl: string;           // Streaming endpoint to receive real-time updates
}
```

**Example Response:**
```json
{
  "streamingId": "abc123-def456-ghi789",
  "streamUrl": "/api/stream/abc123-def456-ghi789"
}
```

**Note:** The `streamingId` returned is CCUI's internal identifier for managing the streaming connection. This is separate from Claude CLI's own session ID that appears in the stream messages.

#### `POST /api/conversations/resume`

Resume an existing conversation using Claude CLI's `--resume` functionality.

**Request Body:**
```typescript
interface ResumeConversationRequest {
  sessionId: string;           // Claude CLI's session ID from conversation history
  message: string;             // New message to continue the conversation
}
```

**Example Request:**
```javascript
const response = await fetch('/api/conversations/resume', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'claude-session-12345',  // From conversation history
    message: 'Continue with this new request'
  })
});
```

**Response:**
```typescript
interface ResumeConversationResponse {
  streamingId: string;         // CCUI's new internal streaming identifier
  streamUrl: string;           // Streaming endpoint to receive real-time updates
}
```

**Example Response:**
```json
{
  "streamingId": "def456-ghi789-jkl012",
  "streamUrl": "/api/stream/def456-ghi789-jkl012"
}
```

**Notes:**
- The `sessionId` in the request is Claude CLI's original session ID (found in conversation history)
- The `streamingId` in the response is a new CCUI streaming identifier for this resumed conversation
- Session parameters (working directory, model, etc.) are inherited from the original conversation
- Only `sessionId` and `message` fields are allowed in the request body

#### `GET /api/conversations`

List all conversations with optional filtering and pagination.

**Query Parameters:**
```typescript
interface ConversationListQuery {
  projectPath?: string;        // Filter by working directory
  limit?: number;              // Max results per page (default: 20)
  offset?: number;             // Skip N results for pagination
  sortBy?: 'created' | 'updated';  // Sort field
  order?: 'asc' | 'desc';      // Sort direction
}
```

**Example Request:**
```javascript
const response = await fetch('/api/conversations?limit=10&sortBy=updated&order=desc');
```

**Conversation Status Values:**
- `completed`: Conversation has finished and no active stream exists
- `ongoing`: Conversation has an active streaming connection (being processed)
- `pending`: Reserved for future features (not currently used)

**Streaming ID Field:**
- The `streamingId` field is only present when a conversation has `status: 'ongoing'`
- This provides the CCUI internal streaming identifier that can be used to connect to the active stream or stop the conversation
- Completed conversations do not include this field since there is no active streaming connection

**Response:**
```typescript
interface ConversationListResponse {
  conversations: ConversationSummary[];  // Array of conversation metadata
  total: number;               // Total count for pagination
}

interface ConversationSummary {
  sessionId: string;        // Claude CLI's actual session ID (used for history files)
  projectPath: string;      // Original working directory
  summary: string;          // Brief description of the conversation
  createdAt: string;        // ISO 8601 timestamp when conversation started
  updatedAt: string;        // ISO 8601 timestamp of last modification
  messageCount: number;     // Total number of messages in the conversation
  status: 'completed' | 'ongoing' | 'pending';  // Conversation status based on active streams
  streamingId?: string;     // CCUI's internal streaming ID (only present when status is 'ongoing')
}
```

#### `GET /api/conversations/:sessionId`

Get complete conversation details including all messages.

**Response:**
```typescript
interface ConversationDetailsResponse {
  messages: ConversationMessage[];  // Complete message history
  summary: string;             // Conversation summary
  projectPath: string;         // Working directory
  metadata: {
    totalCost: number;         // Sum of all message costs
    totalDuration: number;     // Total processing time
    model: string;             // Model used for conversation
  };
}

interface ConversationMessage {
  uuid: string;             // Unique identifier for this specific message
  type: 'user' | 'assistant' | 'system';  // Who sent the message
  message: any;             // Anthropic Message or MessageParam type
  timestamp: string;        // ISO 8601 timestamp when message was created
  sessionId: string;        // Claude CLI's actual session ID
  parentUuid?: string;      // For threading - references previous message in chain
  costUSD?: number;         // API cost for this message (assistant messages only)
  durationMs?: number;      // Time taken to generate response (assistant messages only)
}
```


#### `POST /api/conversations/:streamingId/stop`

Stop an active conversation using CCUI's streaming ID.

**Response:**
```typescript
interface StopConversationResponse {
  success: boolean;            // Whether process was successfully terminated
}
```

### Permission Management

#### `GET /api/permissions`

List pending permission requests.

**Query Parameters:**
```typescript
interface PermissionListQuery {
  streamingId?: string;        // Filter by CCUI streaming ID
  status?: 'pending' | 'approved' | 'denied';  // Filter by status
}
```

**Response:**
```typescript
interface PermissionListResponse {
  permissions: PermissionRequest[];  // Array of permission requests
}

interface PermissionRequest {
  id: string;               // Unique request identifier
  streamingId: string;      // CCUI's streaming ID that triggered this request
  toolName: string;         // Name of the tool Claude wants to use
  toolInput: any;           // Parameters Claude wants to pass to the tool
  timestamp: string;        // When permission was requested
  status: 'pending' | 'approved' | 'denied';  // Current state of the request
  modifiedInput?: any;      // User-modified parameters (if approved with changes)
  denyReason?: string;      // Reason for denial (if denied)
}
```

#### `POST /api/permissions/:requestId`

Approve or deny a permission request.

**Request Body:**
```typescript
interface PermissionDecisionRequest {
  action: 'approve' | 'deny';  // User's decision
  modifiedInput?: any;         // Optional: user can modify tool parameters before approval
}
```

**Response:**
```typescript
interface PermissionDecisionResponse {
  success: boolean;            // Whether decision was recorded
}
```

### System Management

#### `GET /api/system/status`

Get Claude installation and system information.

**Response:**
```typescript
interface SystemStatusResponse {
  claudeVersion: string;       // Version of Claude CLI installed
  claudePath: string;          // Location of Claude executable
  configPath: string;          // Location of Claude config directory
  activeConversations: number; // Number of running Claude processes
}
```

#### `GET /api/models`

Get available Claude models.

**Response:**
```typescript
interface ModelsResponse {
  models: string[];            // List of available model identifiers
  defaultModel: string;        // Default model to use if none specified
}
```

## Real-Time Streaming

### `GET /api/stream/:streamingId`

Establish a real-time streaming connection to receive conversation updates using CCUI's streaming ID.

**Connection Type:** HTTP streaming with newline-delimited JSON (not Server-Sent Events)

**Headers Set by Server:**
```
Content-Type: application/x-ndjson
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

### Frontend Streaming Implementation

```javascript
// Connect to stream (using streamingId from start conversation response)
const response = await fetch(`/api/stream/${streamingId}`);
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const lines = decoder.decode(value).split('\n');
  for (const line of lines) {
    if (line.trim()) {
      const message = JSON.parse(line);
      handleStreamMessage(message);
    }
  }
}
```

### Stream Message Types

All stream messages include these base fields:
```typescript
interface StreamMessage {
  type: string;
  session_id: string;  // Claude CLI's session ID (in stream messages)
  parent_tool_use_id?: string | null;
}
```

**Important Note:** The `session_id` field in stream messages is Claude CLI's internal session ID, not CCUI's `streamingId`. The streaming connection itself is identified by the `streamingId` used in the URL path.

#### Connection Events

**Connected:**
```typescript
interface ConnectedEvent {
  type: 'connected';
  streaming_id: string;  // CCUI's streaming ID
  timestamp: string;
}
```

**Error:**
```typescript
interface ErrorEvent {
  type: 'error';
  error: string;
  streamingId: string;  // CCUI's streaming ID
  timestamp: string;
}
```

**Closed:**
```typescript
interface ClosedEvent {
  type: 'closed';
  streamingId: string;  // CCUI's streaming ID
  timestamp: string;
}
```

#### Claude CLI Stream Messages

**System Initialization:**
```typescript
interface SystemInitMessage {
  type: 'system';
  subtype: 'init';
  cwd: string;
  session_id: string;
  tools: string[];
  mcp_servers: { name: string; status: string; }[];
  model: string;
  permissionMode: string;
  apiKeySource: string;
}
```

**Assistant Message:**
```typescript
interface AssistantStreamMessage {
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
  session_id: string;
}
```

**User Message:**
```typescript
interface UserStreamMessage {
  type: 'user';
  message: {
    role: 'user';
    content: Array<ContentBlockParam>;
  };
  parent_tool_use_id: string | null;
  session_id: string;
}
```

**Result Message:**
```typescript
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

#### Permission Request Events

**Permission Request:**
```typescript
interface PermissionRequestEvent {
  type: 'permission_request';
  data: PermissionRequest;
  streamingId: string;  // CCUI's streaming ID
  timestamp: string;
}
```

## TypeScript Types

### Core Types

```typescript
// Configuration types
interface ConversationConfig {
  workingDirectory: string;
  initialPrompt: string;
  model?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  systemPrompt?: string;
}

// Error types
class CCUIError extends Error {
  constructor(public code: string, message: string, public statusCode: number = 500);
}

// MCP types
interface MCPPermissionToolInput {
  tool_name: string;
  input: Record<string, any>;
  session_id: string;  // Claude CLI's session ID
}

interface MCPPermissionResponse {
  behavior: 'allow' | 'deny';
  updatedInput?: any;
  message?: string;
}
```

### Content Block Types

```typescript
// Based on Anthropic SDK types
type ContentBlock =
  | TextBlock
  | ToolUseBlock
  | ServerToolUseBlock
  | WebSearchToolResultBlock
  | ThinkingBlock
  | RedactedThinkingBlock;

interface TextBlock {
  type: 'text';
  text: string;
  citations?: Array<TextCitation> | null;
}

interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

interface ServerToolUseBlock {
  type: 'server_tool_use';
  id: string;
  name: 'web_search';
  input: unknown;
}

interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
  signature: string;
}

interface RedactedThinkingBlock {
  type: 'redacted_thinking';
  data: string;
}
```

### Usage and Billing Types

```typescript
interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number | null;
  cache_read_input_tokens: number | null;
  server_tool_use: ServerToolUsage | null;
  service_tier: 'standard' | 'priority' | 'batch' | null;
}

interface ServerToolUsage {
  web_search_requests: number;
}

type StopReason = 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | 'pause_turn' | 'refusal';
```

## Error Handling

### HTTP Status Codes

- `200`: Success
- `400`: Bad Request (invalid request format)
- `404`: Not Found (conversation/resource not found)
- `500`: Internal Server Error

### Error Response Format

```typescript
interface ErrorResponse {
  error: string;               // Human-readable error message
  code?: string;               // Machine-readable error code
}
```

### Common Error Codes

- `CONVERSATION_NOT_FOUND`: Specified conversation doesn't exist
- `SYSTEM_STATUS_ERROR`: Failed to get system status
- `MODELS_ERROR`: Failed to get available models
- `PROCESS_START_FAILED`: Failed to start Claude CLI process
- `PERMISSION_REQUEST_NOT_FOUND`: Permission request doesn't exist

### Frontend Error Handling

```javascript
try {
  const response = await fetch('/api/conversations/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestData)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`API Error: ${error.error} (${error.code || 'unknown'})`);
  }
  
  const data = await response.json();
  // Handle success
} catch (error) {
  console.error('Failed to start conversation:', error);
  // Handle error in UI
}
```

## Session ID Architecture

### Understanding the Dual Session ID System

CCUI maintains **two separate session ID systems** for different purposes:

#### 1. CCUI Streaming ID (`streamingId`)
- **Purpose**: CCUI's internal identifier for managing streaming connections and process lifecycle
- **Generated by**: CCUI backend using UUID v4
- **Used for**: 
  - API endpoints that control active conversations (`/continue`, `/stop`)
  - Streaming connections (`/api/stream/:streamingId`)
  - Permission management
- **Scope**: Only exists while the conversation process is active
- **Format**: UUID (e.g., `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"`)

#### 2. Claude CLI Session ID (`session_id`)
- **Purpose**: Claude CLI's internal session tracking
- **Generated by**: Claude CLI itself
- **Used for**:
  - History file names (`~/.claude/projects/{path}/{session_id}.jsonl`)
  - Message correlation within Claude's output stream
  - Conversation history retrieval (`/api/conversations/:sessionId`)
- **Scope**: Persists in history files after conversation ends
- **Format**: Also UUID, but generated independently by Claude

### API Usage Patterns

```typescript
// 1. Start conversation - returns CCUI's streamingId
const startResponse = await fetch('/api/conversations/start', { ... });
const { streamingId, streamUrl } = await startResponse.json();

// 2. Use streamingId for active conversation management
await fetch(`/api/conversations/${streamingId}/stop`, { ... });
await fetch(`/api/stream/${streamingId}`);

// 3. Extract Claude's session_id from stream messages
const streamMessage = JSON.parse(streamLine);
const claudeSessionId = streamMessage.session_id;

// 4. Use Claude's sessionId for history access
const historyResponse = await fetch(`/api/conversations/${claudeSessionId}`);

// 5. Resume an existing conversation
const resumeResponse = await fetch('/api/conversations/resume', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: claudeSessionId,  // From conversation history
    message: 'Continue this conversation'
  })
});
const { streamingId: newStreamingId, streamUrl: newStreamUrl } = await resumeResponse.json();
```

### Why Two Session IDs?

This design provides several benefits:

1. **Independence**: CCUI doesn't depend on Claude CLI's internal session management
2. **Control**: CCUI maintains full control over conversation lifecycle
3. **Consistency**: CCUI session IDs are guaranteed unique within CCUI's scope
4. **Compatibility**: Changes to Claude CLI's session ID format won't break CCUI
5. **Debugging**: Both session IDs are preserved for troubleshooting

### Common Gotchas

- ❌ **Don't** use CCUI's `sessionId` (streamingId) to fetch conversation history
- ❌ **Don't** use Claude's `session_id` for streaming connections
- ✅ **Do** use CCUI's `sessionId` (streamingId) for active conversation management
- ✅ **Do** use Claude's `session_id` for accessing saved conversations and resuming
- ✅ **Do** use Claude's `session_id` from history when calling the resume endpoint

## Frontend Integration Patterns

### Starting a Conversation

```javascript
// 1. Start conversation
const startResponse = await fetch('/api/conversations/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workingDirectory: '/home/user/project',
    initialPrompt: 'Help me refactor this code',
    model: 'claude-opus-4-20250514'
  })
});

const { streamingId, streamUrl } = await startResponse.json();

// 2. Connect to stream for real-time updates
const streamResponse = await fetch(streamUrl);
const reader = streamResponse.body.getReader();
const decoder = new TextDecoder();

// 3. Process streaming messages
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const lines = decoder.decode(value).split('\n');
  for (const line of lines) {
    if (line.trim()) {
      const message = JSON.parse(line);
      
      switch (message.type) {
        case 'connected':
          console.log('Connected to stream');
          break;
        case 'system':
          console.log('Claude initialized:', message);
          break;
        case 'assistant':
          displayAssistantMessage(message.message);
          break;
        case 'result':
          console.log('Conversation complete:', message);
          break;
        case 'permission_request':
          handlePermissionRequest(message.data);
          break;
        case 'error':
          console.error('Stream error:', message.error);
          break;
      }
    }
  }
}
```

### Permission Handling

```javascript
// Handle permission requests from stream
function handlePermissionRequest(request) {
  const { id, toolName, toolInput } = request;
  
  // Show UI to user
  const userDecision = await showPermissionDialog(toolName, toolInput);
  
  // Send decision back to server
  await fetch(`/api/permissions/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: userDecision.approved ? 'approve' : 'deny',
      modifiedInput: userDecision.modifiedInput
    })
  });
}
```


### Building Conversation History UI

```javascript
// Load conversation history (using Claude's sessionId from history)
async function loadConversation(claudeSessionId) {
  const response = await fetch(`/api/conversations/${claudeSessionId}`);
  const conversation = await response.json();
  
  // conversation.messages contains all messages
  // conversation.metadata contains cost and duration info
  
  conversation.messages.forEach(msg => {
    switch (msg.type) {
      case 'user':
        displayUserMessage(msg.message.content);
        break;
      case 'assistant':
        displayAssistantMessage(msg.message.content);
        if (msg.costUSD) {
          displayCost(msg.costUSD);
        }
        break;
    }
  });
}
```

### Resuming a Conversation

```javascript
// Resume an existing conversation
async function resumeConversation(claudeSessionId, newMessage) {
  try {
    const resumeResponse = await fetch('/api/conversations/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: claudeSessionId,  // From conversation history
        message: newMessage
      })
    });
    
    if (!resumeResponse.ok) {
      const error = await resumeResponse.json();
      throw new Error(`Resume failed: ${error.error}`);
    }
    
    const { streamingId: newStreamingId, streamUrl } = await resumeResponse.json();
    
    // Connect to the new stream for the resumed conversation
    const streamResponse = await fetch(streamUrl);
    const reader = streamResponse.body.getReader();
    const decoder = new TextDecoder();
    
    // Process streaming messages as normal
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const lines = decoder.decode(value).split('\n');
      for (const line of lines) {
        if (line.trim()) {
          const message = JSON.parse(line);
          handleStreamMessage(message);
        }
      }
    }
    
  } catch (error) {
    console.error('Failed to resume conversation:', error);
    // Handle error in UI
  }
}
```

---

**Last Updated:** January 19, 2025  
**Backend Version:** Current main branch with resume conversation functionality