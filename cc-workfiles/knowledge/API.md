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

The MCP integration is automatic - CCUI generates a temporary MCP configuration file on startup and passes it to all Claude CLI processes. This enables Claude to request permissions for tool usage through a standardized protocol.

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
  // System init fields from Claude CLI (available immediately after process start)
  sessionId: string;           // Claude CLI's session ID
  cwd: string;                 // Working directory
  tools: string[];             // Available tools
  mcpServers: { name: string; status: string; }[]; // MCP server list
  model: string;               // Actual model being used
  permissionMode: string;      // Permission handling mode
  apiKeySource: string;        // API key source
}
```

**Example Response:**
```json
{
  "streamingId": "abc123-def456-ghi789",
  "streamUrl": "/api/stream/abc123-def456-ghi789",
  "sessionId": "claude-session-xyz789",
  "cwd": "/home/user/project",
  "tools": ["Bash", "Read", "Write", "Edit"],
  "mcpServers": [{"name": "filesystem", "status": "connected"}],
  "model": "claude-3-5-sonnet-20241022",
  "permissionMode": "auto",
  "apiKeySource": "environment"
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
// Same as StartConversationResponse
interface StartConversationResponse {
  streamingId: string;         // CCUI's new internal streaming identifier
  streamUrl: string;           // Streaming endpoint to receive real-time updates
  // System init fields from Claude CLI (available immediately after process start)
  sessionId: string;           // Claude CLI's session ID (may differ from original if Claude creates a new session)
  cwd: string;                 // Working directory (inherited from original conversation)
  tools: string[];             // Available tools
  mcpServers: { name: string; status: string; }[]; // MCP server list
  model: string;               // Actual model being used (inherited from original conversation)
  permissionMode: string;      // Permission handling mode
  apiKeySource: string;        // API key source
}
```

**Example Response:**
```json
{
  "streamingId": "def456-ghi789-jkl012",
  "streamUrl": "/api/stream/def456-ghi789-jkl012",
  "sessionId": "claude-session-abc456",
  "cwd": "/home/user/project",
  "tools": ["Bash", "Read", "Write", "Edit"],
  "mcpServers": [{"name": "filesystem", "status": "connected"}],
  "model": "claude-3-5-sonnet-20241022",
  "permissionMode": "auto",
  "apiKeySource": "environment"
}
```

**Notes:**
- The `sessionId` in the request is Claude CLI's original session ID (found in conversation history)
- The `streamingId` in the response is a new CCUI streaming identifier for this resumed conversation
- Session parameters (working directory, model, etc.) are inherited from the original conversation
- Only `sessionId` and `message` fields are allowed in the request body
- If the session doesn't exist or Claude CLI fails to resume, the endpoint returns an immediate error with Claude's output (e.g., "No conversation found")

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
  custom_name: string;      // Custom name set by user, default: ""
  createdAt: string;        // ISO 8601 timestamp when conversation started
  updatedAt: string;        // ISO 8601 timestamp of last modification
  messageCount: number;     // Total number of messages in the conversation
  status: 'completed' | 'ongoing' | 'pending';  // Conversation status based on active streams
  streamingId?: string;     // CCUI's internal streaming ID (only present when status is 'ongoing')
  toolMetrics?: ToolMetrics; // Optional tool usage metrics (see below)
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
  toolMetrics?: ToolMetrics;   // Optional tool usage metrics (see below)
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

#### `PUT /api/conversations/:sessionId/rename` (Deprecated)

Update the custom name for a conversation session. **This endpoint is deprecated - use `/api/conversations/:sessionId/update` instead.**

**Request Body:**
```typescript
interface SessionRenameRequest {
  customName: string;          // New custom name for the session (up to 200 characters)
}
```

#### `PUT /api/conversations/:sessionId/update`

Update session information including custom name, pinned status, archived status, and other metadata.

**Request Body:**
```typescript
interface SessionUpdateRequest {
  customName?: string;           // Optional: update custom name (up to 200 characters)
  pinned?: boolean;              // Optional: update pinned status
  archived?: boolean;            // Optional: update archived status
  continuationSessionId?: string; // Optional: update continuation session ID
  initialCommitHead?: string;    // Optional: update initial git commit HEAD
}
```

**Response:**
```typescript
interface SessionUpdateResponse {
  success: boolean;
  sessionId: string;
  updatedFields: SessionInfo;    // Returns the complete updated session info
}

interface SessionInfo {
  custom_name: string;           // Custom name for the session
  created_at: string;            // ISO 8601 timestamp when session info was created
  updated_at: string;            // ISO 8601 timestamp when session info was last updated
  version: number;               // Schema version for future migrations
  pinned: boolean;               // Whether session is pinned
  archived: boolean;             // Whether session is archived
  continuation_session_id: string; // ID of the continuation session if exists
  initial_commit_head: string;   // Git commit HEAD when session started
}
```

**Notes:**
- Only provided fields in the request will be updated
- If session doesn't exist in the database, it will be created with defaults
- Custom name is trimmed of whitespace before saving
- Returns 404 if the conversation session doesn't exist in history

**Tool Metrics:**
The `toolMetrics` field provides statistics about tool usage (Edit, MultiEdit, Write) in conversations:
- **For active conversations**: Metrics are calculated in real-time as tool use messages are processed
- **For historical conversations**: Metrics are calculated when loading conversation history  
- **Line counting**: Lines are counted by splitting on `\n` characters, with trailing newlines handled properly
- **Edit metrics**: For Edit/MultiEdit tools, the difference between old and new content is calculated
- **Write metrics**: For Write tools, all lines in the content are counted as added
- **Accumulation**: Metrics accumulate across all tool uses in a conversation

### Working Directories

#### `GET /api/working-directories`

Get all unique working directories from conversation history with computed smart suffixes.

**Response:**
```typescript
interface WorkingDirectoriesResponse {
  directories: WorkingDirectory[];  // Array of directories sorted by lastDate (newest first)
  totalCount: number;              // Total number of unique directories
}

interface WorkingDirectory {
  path: string;              // Full absolute path (e.g., "/home/user/projects/myapp")
  shortname: string;         // Smart suffix (e.g., "myapp" or "projects/myapp")
  lastDate: string;          // ISO timestamp of most recent conversation
  conversationCount: number; // Total conversations in this directory
}
```

**Smart Suffix Algorithm:**
The `shortname` field provides the shortest unique suffix for each directory path:
- For unique last segments: uses just the last segment (e.g., `/home/user/web` → `web`)
- For conflicting paths: includes parent segments until unique (e.g., `/home/alice/project` and `/home/bob/project` → `alice/project` and `bob/project`)
- For single directory: uses the last segment only

**Example Response:**
```json
{
  "directories": [
    {
      "path": "/home/user/repos/ccui",
      "shortname": "ccui",
      "lastDate": "2025-01-22T10:30:00Z",
      "conversationCount": 15
    },
    {
      "path": "/home/alice/projects/web",
      "shortname": "alice/projects/web",
      "lastDate": "2025-01-21T14:20:00Z",
      "conversationCount": 8
    },
    {
      "path": "/home/bob/projects/web",
      "shortname": "bob/projects/web",
      "lastDate": "2025-01-20T09:15:00Z",
      "conversationCount": 3
    }
  ],
  "totalCount": 3
}
```

**Example Request:**
```javascript
const response = await fetch('/api/conversations/claude-session-12345/rename', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customName: 'My Important Project Discussion'
  })
});
```

**Response:**
```typescript
interface SessionRenameResponse {
  success: boolean;            // Whether the rename was successful
  sessionId: string;           // The session ID that was renamed
  customName: string;          // The new custom name (trimmed)
}
```

**Example Response:**
```json
{
  "success": true,
  "sessionId": "claude-session-12345",
  "customName": "My Important Project Discussion"
}
```

**Notes:**
- Custom names are trimmed of whitespace
- Maximum length is 200 characters
- Empty string is allowed to clear the custom name
- Returns 404 if the session doesn't exist
- Custom names are stored in `~/.ccui/session-info.json` using lowdb

### Permission Management

CCUI integrates with Claude's Model Context Protocol (MCP) to handle tool permission requests. When Claude attempts to use a tool, it can request permission through the MCP permission server that CCUI automatically configures.

#### `GET /api/permissions`

List permission requests that have been received from Claude via the MCP server.

**Query Parameters:**
```typescript
interface PermissionListQuery {
  streamingId?: string;        // Filter by CCUI streaming ID (optional)
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

**Notes:**
- Currently, all permission requests are automatically approved
- The streamingId field is properly associated with each permission request via environment variables passed to the MCP server
- Permission requests are automatically cleaned up when a conversation ends
- You can retrieve all permissions without filtering, or filter by specific streamingId or status

#### `POST /api/permissions/notify` (Internal)

This endpoint is called by the MCP permission server when Claude requests permission to use a tool. It is not intended for direct frontend use.

**Request Body:**
```typescript
interface PermissionNotifyRequest {
  toolName: string;            // Name of the tool requesting permission
  toolInput: any;              // Tool parameters
  streamingId?: string;        // CCUI streaming ID (automatically provided by MCP server)
}
```

**Response:**
```typescript
interface PermissionNotifyResponse {
  success: boolean;            // Whether the request was recorded
  id: string;                  // Permission request ID
}
```

#### `POST /api/permissions/:requestId/decision`

Approve or deny a permission request. The MCP server polls this endpoint to check for decisions.

**Request Body:**
```typescript
interface PermissionDecisionRequest {
  action: 'approve' | 'deny';  // User's decision
  modifiedInput?: any;         // Optional: user can modify tool parameters before approval
  denyReason?: string;         // Optional: reason for denial (if action is 'deny')
}
```

**Response:**
```typescript
interface PermissionDecisionResponse {
  success: boolean;            // Whether decision was recorded
  message?: string;            // Success/error message
}
```

**Error Responses:**
- `400 Bad Request`: Invalid action (must be 'approve' or 'deny')
- `404 Not Found`: Permission request not found or already processed

**Notes:**
- The MCP server polls for decisions every second
- Decisions have a 10-minute timeout - after which they are automatically denied
- Once a decision is made, the permission request status is updated and the MCP server is notified

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

### Log Streaming

#### `GET /api/logs/recent`

Get recent server logs from the circular buffer.

**Query Parameters:**
```typescript
interface LogQuery {
  limit?: number;              // Maximum number of log entries to return (default: 100, use 0 for empty array)
}
```

**Example Requests:**
```javascript
// Get last 50 logs
const response = await fetch('/api/logs/recent?limit=50');

// Get empty array (useful for clearing UI)
const emptyResponse = await fetch('/api/logs/recent?limit=0');
```

**Response:**
```typescript
interface LogResponse {
  logs: string[];              // Array of log lines (JSONL format)
}
```

**Example Response:**
```json
{
  "logs": [
    "{\"level\":\"info\",\"time\":\"2025-07-04T09:25:46.406Z\",\"pid\":53980,\"hostname\":\"server\",\"component\":\"CCUIServer\",\"msg\":\"Starting CCUI server on port 3001\"}",
    "{\"level\":\"debug\",\"time\":\"2025-07-04T09:25:46.407Z\",\"pid\":53980,\"hostname\":\"server\",\"component\":\"StreamManager\",\"msg\":\"Stream connection opened\"}"
  ]
}
```

#### `GET /api/logs/stream`

Establish a real-time streaming connection to receive server logs via Server-Sent Events.

**Connection Type:** Server-Sent Events (SSE)

**Headers Set by Server:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

**Frontend Implementation:**
```javascript
// Connect to log stream
const response = await fetch('/api/logs/stream');
const reader = response.body.getReader();
const decoder = new TextDecoder();

let buffer = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value, { stream: true });
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.trim()) {
      if (line.startsWith('data: ')) {
        const logLine = line.substring(6);
        handleLogLine(logLine);
      }
      // Skip heartbeat and comments (lines starting with :)
    }
  }
}
```

**Stream Events:**
- **Log Data:** `data: {JSON log entry}`
- **Heartbeat:** `:heartbeat` (every 30 seconds)
- **Connection Confirmation:** `:ok` (on initial connect)

**Log Entry Format:**
Log entries are streamed as JSONL (JSON Lines) format. Each log entry typically contains:

```typescript
interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  time: string;                // ISO 8601 timestamp
  pid: number;                 // Process ID
  hostname: string;            // Server hostname
  component?: string;          // Source component name
  msg: string;                 // Log message
  requestId?: string;          // Request correlation ID
  streamingId?: string;        // CCUI streaming ID (for conversation-related logs)
  sessionId?: string;          // Claude session ID (for conversation-related logs)
  [key: string]: any;          // Additional context fields
}
```

**Example Log Entries:**
```json
{"level":"info","time":"2025-07-04T09:25:46.406Z","pid":53980,"hostname":"server","component":"CCUIServer","msg":"Starting CCUI server on port 3001"}
{"level":"debug","time":"2025-07-04T09:25:46.407Z","pid":53980,"hostname":"server","component":"StreamManager","streamingId":"abc-123","msg":"Stream connection opened"}
{"level":"warn","time":"2025-07-04T09:25:46.408Z","pid":53980,"hostname":"server","component":"ClaudeProcessManager","requestId":"req-456","msg":"Claude process took longer than expected"}
```

**Notes:**
- The log stream captures all server logs in real-time
- Logs are also written to stdout as usual
- Connection includes automatic heartbeat to prevent timeouts
- Logs are buffered in a circular buffer (default 1000 entries)
- Both endpoints are designed for development and debugging purposes

### File System Utilities

#### `GET /api/filesystem/list`

List directory contents with comprehensive security checks.

**Query Parameters:**
```typescript
interface FileSystemListQuery {
  path: string;                // Absolute path to directory (required)
  recursive?: boolean;         // Include subdirectories recursively (optional, default: false)
  respectGitignore?: boolean;  // Filter out gitignored files (optional, default: false)
}
```

**Example Requests:**
```javascript
// Basic listing
const response = await fetch('/api/filesystem/list?path=/home/user/project');

// Recursive listing
const response = await fetch('/api/filesystem/list?path=/home/user/project&recursive=true');

// Respect gitignore patterns
const response = await fetch('/api/filesystem/list?path=/home/user/project&respectGitignore=true');

// Both recursive and gitignore
const response = await fetch('/api/filesystem/list?path=/home/user/project&recursive=true&respectGitignore=true');
```

**Response:**
```typescript
interface FileSystemListResponse {
  path: string;                // Normalized absolute path
  entries: FileSystemEntry[];  // Array of files and directories
  total: number;               // Total number of entries
}

interface FileSystemEntry {
  name: string;                // File or directory name (relative path for recursive)
  type: 'file' | 'directory';  // Entry type
  size?: number;               // File size in bytes (files only)
  lastModified: string;        // ISO 8601 timestamp
}
```

**Example Response (Non-recursive):**
```json
{
  "path": "/home/user/project",
  "entries": [
    {
      "name": "src",
      "type": "directory",
      "lastModified": "2025-01-20T10:30:00.000Z"
    },
    {
      "name": "package.json",
      "type": "file",
      "size": 1234,
      "lastModified": "2025-01-19T15:45:00.000Z"
    }
  ],
  "total": 2
}
```

**Example Response (Recursive):**
```json
{
  "path": "/home/user/project",
  "entries": [
    {
      "name": "src",
      "type": "directory",
      "lastModified": "2025-01-20T10:30:00.000Z"
    },
    {
      "name": "src/index.ts",
      "type": "file",
      "size": 567,
      "lastModified": "2025-01-20T11:00:00.000Z"
    },
    {
      "name": "src/components",
      "type": "directory",
      "lastModified": "2025-01-20T10:45:00.000Z"
    },
    {
      "name": "src/components/Button.tsx",
      "type": "file",
      "size": 890,
      "lastModified": "2025-01-20T10:45:00.000Z"
    },
    {
      "name": "package.json",
      "type": "file",
      "size": 1234,
      "lastModified": "2025-01-19T15:45:00.000Z"
    }
  ],
  "total": 5
}
```

#### `GET /api/filesystem/read`

Read file contents with security validation and size limits.

**Query Parameters:**
```typescript
interface FileSystemReadQuery {
  path: string;                // Absolute path to file (required)
}
```

**Example Request:**
```javascript
const response = await fetch('/api/filesystem/read?path=/home/user/project/package.json');
```

**Response:**
```typescript
interface FileSystemReadResponse {
  path: string;                // Normalized absolute path
  content: string;             // File contents (UTF-8)
  size: number;                // File size in bytes
  lastModified: string;        // ISO 8601 timestamp
  encoding: string;            // Always "utf-8"
}
```

**Example Response:**
```json
{
  "path": "/home/user/project/package.json",
  "content": "{\n  \"name\": \"my-project\",\n  \"version\": \"1.0.0\"\n}",
  "size": 54,
  "lastModified": "2025-01-19T15:45:00.000Z",
  "encoding": "utf-8"
}
```

**Security Features:**
- **Path Traversal Prevention**: Rejects paths containing `..`
- **Absolute Paths Required**: All paths must be absolute
- **Hidden Files Blocked**: Files/directories starting with `.` are rejected
- **Null Byte Protection**: Paths with null bytes are rejected
- **Invalid Character Validation**: Rejects paths with `<>:|?*`
- **File Size Limits**: Default 10MB limit (configurable)
- **Binary File Detection**: Only UTF-8 text files are allowed
- **Optional Base Path Restrictions**: Can be configured via FileSystemService

**Gitignore Behavior:**
- When `respectGitignore=true`, the endpoint reads `.gitignore` files in the requested directory
- Patterns from `.gitignore` are applied to filter out matching files and directories
- The `.git` directory is always excluded when gitignore is enabled
- Works with both flat and recursive listings

**Error Codes:**
- `INVALID_PATH`: Path is not absolute or contains invalid format
- `PATH_TRAVERSAL_DETECTED`: Path contains traversal attempt (`..`)
- `PATH_NOT_ALLOWED`: Path is outside allowed directories (when restricted)
- `PATH_NOT_FOUND`: Directory or file does not exist
- `NOT_A_DIRECTORY`: Path exists but is not a directory (list endpoint)
- `NOT_A_FILE`: Path exists but is not a file (read endpoint)
- `ACCESS_DENIED`: No read permission for the path
- `FILE_TOO_LARGE`: File exceeds maximum size limit
- `BINARY_FILE`: File contains binary data or invalid UTF-8
- `LIST_DIRECTORY_FAILED`: General directory listing failure
- `READ_FILE_FAILED`: General file reading failure

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

**Important Note:** System initialization messages are **NOT** broadcast through the streaming connection. They are included directly in the API response from `/api/conversations/start` and `/api/conversations/resume` endpoints. This allows clients to access session metadata immediately without parsing streaming messages.

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
// Tool metrics types
interface ToolMetrics {
  linesAdded: number;         // Total lines added across all edits/writes
  linesRemoved: number;       // Total lines removed across all edits
  editCount: number;          // Number of Edit/MultiEdit tool calls
  writeCount: number;         // Number of Write tool calls
}

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

// File system types
interface FileSystemEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified: string;
}

interface FileSystemListQuery {
  path: string;
}

interface FileSystemListResponse {
  path: string;
  entries: FileSystemEntry[];
  total: number;
}

interface FileSystemReadQuery {
  path: string;
}

interface FileSystemReadResponse {
  path: string;
  content: string;
  size: number;
  lastModified: string;
  encoding: string;
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
- `CLAUDE_PROCESS_EXITED_EARLY`: Claude CLI process exited before sending system initialization
- `SYSTEM_INIT_TIMEOUT`: Timeout waiting for system initialization from Claude CLI (15 seconds)
- `INVALID_SYSTEM_INIT`: First message from Claude CLI was not a system init message
- `INCOMPLETE_SYSTEM_INIT`: System init message missing required fields
- `CLAUDE_NOT_FOUND`: Claude CLI executable not found in PATH
- `PROCESS_RESUME_FAILED`: Failed to resume Claude process
- `PROCESS_SPAWN_FAILED`: Failed to spawn Claude process

### Claude CLI Process Error Handling

When Claude CLI fails to start or exits unexpectedly, the backend provides immediate error feedback with context about what went wrong. This is especially useful for authentication and configuration issues.

#### Fast Failure Detection

The backend monitors Claude CLI processes and fails immediately when:
- Claude CLI outputs plain text errors instead of JSON (e.g., "Invalid API key")
- The process exits before sending a system initialization message
- Authentication or configuration issues prevent normal operation

**Example: Authentication Error**
```json
{
  "error": "Claude CLI process exited before sending system initialization message. Claude CLI said: \"Invalid API key · Please run /login\". Exit code: 1",
  "code": "CLAUDE_PROCESS_EXITED_EARLY"
}
```

**Example: Session Not Found (Resume)**
```json
{
  "error": "Claude CLI process exited before sending system initialization message. Claude CLI said: \"No conversation found with session ID: abc123\". Exit code: 1",
  "code": "CLAUDE_PROCESS_EXITED_EARLY"
}
```

**Example: Claude Not Installed**
```json
{
  "error": "Claude CLI not found. Please ensure Claude is installed and in PATH.",
  "code": "CLAUDE_NOT_FOUND"
}
```

#### Benefits for Frontend Development

1. **Immediate Feedback**: Errors are detected and returned immediately instead of waiting for a 15-second timeout
2. **Clear Error Context**: The actual Claude CLI output is included in error messages
3. **Actionable Messages**: Users can see exactly what Claude CLI said (e.g., "Please run /login")
4. **Exit Codes**: Process exit codes are included for debugging

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
    
    // Handle specific Claude CLI errors
    if (error.code === 'CLAUDE_PROCESS_EXITED_EARLY') {
      // Extract Claude's message from the error
      const match = error.error.match(/Claude CLI said: "(.+?)"/);
      if (match && match[1].includes('Invalid API key')) {
        showAuthError('Claude API key is invalid. Please run "claude login" in your terminal.');
      } else if (match && match[1].includes('No conversation found')) {
        showSessionError('The conversation session no longer exists.');
      } else {
        showGeneralError(error.error);
      }
    } else if (error.code === 'CLAUDE_NOT_FOUND') {
      showInstallError('Claude CLI is not installed. Please install it first.');
    } else {
      throw new Error(`API Error: ${error.error} (${error.code || 'unknown'})`);
    }
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

const { 
  streamingId, 
  streamUrl, 
  sessionId, 
  cwd, 
  tools, 
  mcpServers, 
  model, 
  permissionMode, 
  apiKeySource 
} = await startResponse.json();

// System information is now immediately available in the response
console.log('Conversation started:', {
  claudeSessionId: sessionId,
  workingDirectory: cwd,
  model: model,
  availableTools: tools,
  mcpServers: mcpServers
});

// 2. Connect to stream for real-time updates
const streamResponse = await fetch(streamUrl);
const reader = streamResponse.body.getReader();
const decoder = new TextDecoder();

// 3. Process streaming messages (note: no system init messages in stream)
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
        // Note: 'system' init messages are no longer broadcast via stream
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
  await fetch(`/api/permissions/${id}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: userDecision.approved ? 'approve' : 'deny',
      modifiedInput: userDecision.modifiedInput,
      denyReason: userDecision.denyReason
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
    
    const { 
      streamingId: newStreamingId, 
      streamUrl, 
      sessionId, 
      cwd, 
      tools, 
      mcpServers, 
      model, 
      permissionMode, 
      apiKeySource 
    } = await resumeResponse.json();
    
    // System information is immediately available in the response
    console.log('Conversation resumed:', {
      originalSessionId: claudeSessionId,
      newSessionId: sessionId,  // May be same or different
      workingDirectory: cwd,
      model: model,
      availableTools: tools
    });
    
    // Connect to the new stream for the resumed conversation
    const streamResponse = await fetch(streamUrl);
    const reader = streamResponse.body.getReader();
    const decoder = new TextDecoder();
    
    // Process streaming messages as normal (no system init in stream)
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

**Last Updated:** January 2025  
**Backend Version:** Current main branch with resume conversation functionality, improved Claude CLI error handling, file system utility endpoints, and enhanced permission tracking with proper streaming ID association