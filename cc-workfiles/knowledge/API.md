# CCUI API Documentation

## Server Configuration

### Command Line Options

The CCUI server supports the following command-line options:

```bash
# Start on a custom port
npm run dev -- --port 3002

# Start on a custom host
npm run dev -- --host 0.0.0.0

# Both options
npm run dev -- --port 3002 --host 0.0.0.0
```

### Environment Variables

You can also configure the server using environment variables:

```bash
# Set custom port
CCUI_PORT=3002 npm run dev

# Set custom host
CCUI_HOST=0.0.0.0 npm run dev

# Both
CCUI_HOST=0.0.0.0 CCUI_PORT=3002 npm run dev
```

Note: Command-line arguments take precedence over environment variables, and both take precedence over the configuration file (`~/.ccui/config.json`).

## Conversation Endpoints

### Start Conversation (Unified Start/Resume)

`POST /api/conversations/start`

Starts a new conversation or resumes an existing one if `resumedSessionId` is provided.

#### Request Body

```typescript
interface StartConversationRequest {
  workingDirectory: string;      // Required: Working directory for the conversation
  initialPrompt: string;         // Required: Initial prompt or message
  model?: string;                // Optional: Model to use
  allowedTools?: string[];       // Optional: List of allowed tools
  disallowedTools?: string[];    // Optional: List of disallowed tools
  systemPrompt?: string;         // Optional: System prompt
  permissionMode?: string;       // Optional: Permission mode ("acceptEdits" | "bypassPermissions" | "default" | "plan")
  resumedSessionId?: string;     // Optional: Session ID to resume from
}
```

#### Behavior

- **New conversation**: When `resumedSessionId` is not provided, starts a fresh conversation
- **Resume conversation**: When `resumedSessionId` is provided:
  - Fetches previous messages from the original session
  - Inherits permission mode from original session if not explicitly provided
  - Updates original session with continuation_session_id
  - Passes `--resume` flag to Claude CLI with the session ID

#### Response

```typescript
interface StartConversationResponse {
  streamingId: string;          // CCUI's internal streaming identifier
  streamUrl: string;            // URL for streaming updates
  sessionId: string;            // Claude CLI's session ID
  cwd: string;                  // Working directory
  tools: string[];              // Available tools
  mcpServers: { name: string; status: string; }[];  // MCP server list
  model: string;                // Actual model being used
  permissionMode: string;       // Permission handling mode
  apiKeySource: string;         // API key source
}
```

### List Conversations

`GET /api/conversations`

Lists all conversations with filtering and pagination options.

#### Query Parameters

```typescript
interface ConversationListQuery {
  projectPath?: string;         // Filter by project path
  limit?: number;               // Number of results (default: 50)
  offset?: number;              // Pagination offset
  sortBy?: 'created' | 'updated';  // Sort field
  order?: 'asc' | 'desc';       // Sort order
  hasContinuation?: boolean;    // Filter by continuation status
  archived?: boolean;           // Filter by archived status
  pinned?: boolean;             // Filter by pinned status
}
```

### Get Conversation Details

`GET /api/conversations/:sessionId`

Retrieves detailed messages and metadata for a specific conversation.

### Stop Conversation

`POST /api/conversations/:streamingId/stop`

Stops an active conversation by its streaming ID.

### Update Session Info

`PUT /api/conversations/:sessionId/update`

Updates session metadata (custom name, pinned status, archived status, etc.).

#### Request Body

```typescript
interface SessionUpdateRequest {
  customName?: string;           // Optional: update custom name
  pinned?: boolean;              // Optional: update pinned status
  archived?: boolean;            // Optional: update archived status
  continuationSessionId?: string; // Optional: update continuation session
  initialCommitHead?: string;    // Optional: update initial commit head
  permissionMode?: string;       // Optional: update permission mode
}
```

### Archive All Sessions

`POST /api/conversations/archive-all`

Archives all non-archived sessions.

## Streaming API

`GET /api/stream/:streamingId`

Establishes a streaming connection for real-time conversation updates using newline-delimited JSON.

## Permission API

### Get Pending Permissions

`GET /api/permissions`

Returns all pending permission requests.

### Make Permission Decision

`POST /api/permissions/:requestId/decision`

Approves or denies a permission request.

#### Request Body

```typescript
interface PermissionDecisionRequest {
  action: 'approve' | 'deny';
  modifiedInput?: Record<string, any>;  // For approve with edits
  denyReason?: string;                   // For deny with reason
}
```

## System API

### Get System Status

`GET /api/system/status`

Returns system status including Claude version and active conversations.

### Get Available Models

`GET /api/system/models`

Returns list of available models and the default model.

## File System API

### List Files

`GET /api/filesystem/list`

Lists files and directories at a given path.

### Read File

`GET /api/filesystem/read`

Reads the content of a file.

## Working Directories API

### Get Working Directories

`GET /api/working-directories`

Returns list of working directories with conversation counts.

## Preferences API

### Get Preferences

`GET /api/preferences`

Returns user preferences including color scheme and language.

### Update Preferences

`PUT /api/preferences`

Updates user preferences.