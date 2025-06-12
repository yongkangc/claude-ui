# CCUI Backend Implementation Plan

## 1. Framework, Toolchain & Architecture

### Core Technologies
```
# The backend requires these specific technologies to function properly
# Each technology serves a specific purpose in the CCUI ecosystem
```
- **Runtime**: Node.js v20+ with TypeScript
- **Web Framework**: Express.js (for familiarity) or Fastify (for performance)
- **Real-time Communication**: Newline-delimited JSON streaming for conversation updates
- **Process Management**: Node.js `child_process.spawn()` for Claude CLI invocation
- **JSONL Parsing**: `@streamparser/json` for efficient streaming JSON Lines parsing
- **MCP Framework**: `@modelcontextprotocol/sdk` for permission handling
- **File System**: Node.js native `fs/promises` for reading Claude history
- **Validation**: Zod for request/response validation
- **Logging**: Pino for structured logging

### Architecture Overview
```
# This diagram shows the data flow between components
# Arrows indicate the direction of communication
# The Frontend initiates requests, Backend manages processes, and MCP handles permissions
```
```
┌─────────────────┐     ┌────────────────┐     ┌───────────────┐
│   Frontend      │────▶│  CCUI Backend  │────▶│  Claude CLI   │
│   (Browser)     │◀────│    Server      │◀────│   Process     │
└─────────────────┘     └────────────────┘     └───────────────┘
         │                       │                      │
         │                       ▼                      │
         │              ┌────────────────┐             │
         └──────────────│  MCP Server    │◀────────────┘
                        │  (Permissions) │
                        └────────────────┘
```

### Key Design Decisions
```
# These architectural decisions shape how the system operates
# Each decision impacts implementation approach
```
1. **Streaming over WebSockets**: Since communication is primarily server-to-client (streaming Claude output), newline-delimited JSON streaming is simpler and matches Claude CLI's output format
2. **Process Pool**: Maintain a pool of active Claude processes indexed by session ID
3. **Streaming Parser**: Parse JSONL incrementally as it arrives from Claude CLI
4. **Stateful MCP**: The MCP server maintains pending permission requests with session context

## 2. Full API Schema

### Base Types
```typescript
# These interfaces define the core data structures used throughout the API
# They represent the shape of data exchanged between frontend and backend

interface ConversationSummary {
  sessionId: string;        # Unique identifier for the conversation (UUID format)
  projectPath: string;      # Original working directory where conversation started
  summary: string;          # Brief description of the conversation (from first JSONL line)
  createdAt: string;        # ISO 8601 timestamp when conversation file was created
  updatedAt: string;        # ISO 8601 timestamp of last modification
  messageCount: number;     # Total number of messages in the conversation
}

interface ConversationMessage {
  uuid: string;             # Unique identifier for this specific message
  type: 'user' | 'assistant' | 'system';  # Who sent the message
  message: any;             # Anthropic Message or MessageParam type - contains actual content
  timestamp: string;        # ISO 8601 timestamp when message was created
  sessionId: string;        # Links message to parent conversation
  parentUuid?: string;      # For threading - references previous message in chain
  costUSD?: number;         # API cost for this message (assistant messages only)
  durationMs?: number;      # Time taken to generate response (assistant messages only)
}

# Stream message interfaces (Updated)
interface StreamMessage {
  type: 'system' | 'assistant' | 'user' | 'result';
  session_id: string;
  parent_tool_use_id?: string | null;
}

interface SystemInitMessage extends StreamMessage {
  type: 'system';
  subtype: 'init';
  cwd: string;
  tools: string[];
  mcp_servers: { name: string; status: string; }[];
  model: string;
  permissionMode: string;
  apiKeySource: string;
}

interface AssistantStreamMessage extends StreamMessage {
  type: 'assistant';
  message: Message; // Full Anthropic Message type
}

interface UserStreamMessage extends StreamMessage {
  type: 'user';
  message: MessageParam; // Anthropic MessageParam type
}

interface ResultStreamMessage extends StreamMessage {
  type: 'result';
  subtype: 'success' | 'error_max_turns';
  cost_usd: number;
  is_error: boolean;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  result?: string; // Only for success
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
}

interface PermissionRequest {
  # Represents a tool execution that requires user approval
  id: string;               # Unique request identifier
  sessionId: string;        # Which conversation triggered this request
  toolName: string;         # Name of the tool Claude wants to use
  toolInput: any;           # Parameters Claude wants to pass to the tool
  timestamp: string;        # When permission was requested
  status: 'pending' | 'approved' | 'denied';  # Current state of the request
}
```

### REST API Endpoints

#### 1. Conversation Management
```typescript
# These endpoints handle the lifecycle of conversations
# They allow creating, listing, continuing, and stopping conversations

// Start new conversation
# Initiates a new Claude conversation in a specific directory
# Returns immediately with session info while conversation runs in background
POST /api/conversations/start
Request: {
  workingDirectory: string;    # Absolute path where Claude should operate
  initialPrompt: string;       # First message to send to Claude
  model?: string;              # Optional: specific model version (e.g., 'opus', 'sonnet')
  allowedTools?: string[];     # Optional: whitelist of tools Claude can use without asking
  disallowedTools?: string[];  # Optional: blacklist of tools Claude cannot use
  systemPrompt?: string;       # Optional: override default system prompt
}
Response: {
  sessionId: string;           # Unique identifier for this conversation
  streamUrl: string;           # Streaming endpoint to receive real-time updates
}

// List all conversations
# Retrieves conversation history from ~/.claude/projects
# Supports pagination and filtering
GET /api/conversations
Query: {
  projectPath?: string;        # Filter by working directory
  limit?: number;              # Max results per page (default: 20)
  offset?: number;             # Skip N results for pagination
  sortBy?: 'created' | 'updated';  # Sort field
  order?: 'asc' | 'desc';      # Sort direction
}
Response: {
  conversations: ConversationSummary[];  # Array of conversation metadata
  total: number;               # Total count for pagination
}

// Get conversation details
# Fetches full message history for a specific conversation
# Reads and parses the JSONL file from disk
GET /api/conversations/:sessionId
Response: {
  messages: ConversationMessage[];  # Complete message history
  summary: string;             # Conversation summary
  projectPath: string;         # Working directory
  metadata: {
    totalCost: number;         # Sum of all message costs
    totalDuration: number;     # Total processing time
    model: string;             # Model used for conversation
  };
}

// Continue conversation
# Sends a new message to an existing conversation
# Only works if conversation process is still active
POST /api/conversations/:sessionId/continue
Request: {
  prompt: string;              # New message to send to Claude
}
Response: {
  streamUrl: string;           # Same streaming endpoint as before
}

// Stop active conversation
# Terminates the Claude process for this session
# Useful for cleanup or canceling long-running operations
POST /api/conversations/:sessionId/stop
Response: {
  success: boolean;            # Whether process was successfully terminated
}
```

#### 2. Streaming Endpoint
```typescript
# Newline-delimited JSON stream endpoint for real-time updates
# Client should use fetch with streaming response

// Stream conversation updates
# Long-lived connection that streams Claude's responses as they arrive
# Automatically closes when conversation completes
GET /api/stream/:sessionId
Response: Newline-delimited JSON stream (not SSE!)
Format: Each line is a complete JSON object

# Example stream:
{"type":"system","subtype":"init","cwd":"/home/user/project","session_id":"abc123","tools":["bash","read_file"],"mcp_servers":[{"name":"ccui","status":"connected"}],"model":"claude-3-5-sonnet-20241022","permissionMode":"ask","apiKeySource":"environment"}
{"type":"assistant","message":{"id":"msg_123","content":[{"type":"text","text":"Hello! How can I help you?"}],"model":"claude-3-5-sonnet-20241022","role":"assistant","stop_reason":"end_turn","stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":12}},"session_id":"abc123"}
{"type":"user","message":{"role":"user","content":"List files in the current directory"},"session_id":"abc123"}
{"type":"result","subtype":"success","cost_usd":0.003,"is_error":false,"duration_ms":1500,"duration_api_ms":800,"num_turns":2,"result":"Conversation completed successfully","total_cost":0.003,"usage":{"input_tokens":45,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":25,"server_tool_use":{"web_search_requests":0}},"session_id":"abc123"}
```

#### 3. Permission Management
```typescript
# These endpoints handle tool permission requests
# They work in conjunction with the MCP server

// List pending permissions
# Shows all permission requests awaiting user decision
# Can be filtered by session or status
GET /api/permissions
Query: {
  sessionId?: string;          # Filter by conversation
  status?: 'pending' | 'approved' | 'denied';  # Filter by status
}
Response: {
  permissions: PermissionRequest[];  # Array of permission requests
}

// Approve/Deny permission
# User's decision on whether Claude can execute a tool
# Must be called while request is still pending
POST /api/permissions/:requestId
Request: {
  action: 'approve' | 'deny';  # User's decision
  modifiedInput?: any;         # Optional: user can modify tool parameters before approval
}
Response: {
  success: boolean;            # Whether decision was recorded
}
```

#### 4. System Management
```typescript
# Utility endpoints for system information

// Get Claude installation info
# Provides details about the Claude CLI installation
# Useful for debugging and version checks
GET /api/system/status
Response: {
  claudeVersion: string;       # Version of Claude CLI installed
  claudePath: string;          # Location of Claude executable
  configPath: string;          # Location of Claude config directory
  activeConversations: number; # Number of running Claude processes
}

// Get available models
# Lists Claude models that can be used
# Frontend can use this to populate model selection dropdown
GET /api/models
Response: {
  models: string[];            # Array of model identifiers
  defaultModel: string;        # Which model is used by default
}
```

## 3. Feature Implementation Details

### A. Claude CLI Process Management
```typescript
# This class manages the lifecycle of Claude CLI processes
# Each conversation runs as a separate child process

class ClaudeProcessManager {
  # Maps session IDs to their corresponding Node.js child processes
  private processes: Map<string, ChildProcess> = new Map();
  
  # Temporary storage for incomplete output lines
  private outputBuffers: Map<string, string> = new Map();
  
  async startConversation(config: ConversationConfig): Promise<string> {
    # Generate unique session identifier
    const sessionId = generateSessionId();
    
    # Build command arguments for Claude CLI
    # These flags configure how Claude behaves
    const args = [
      '-p',                      # Print mode - required for programmatic use
      '--output-format', 'stream-json',  # JSONL output format
      '--mcp-config', this.mcpConfigPath,  # Path to MCP configuration
      '--permission-prompt-tool', 'mcp__ccui__permission_prompt'  # Our MCP tool name
    ];
    
    # Add optional configuration flags
    if (config.workingDirectory) {
      args.push('--add-dir', config.workingDirectory);  # Grant access to directory
    }
    
    if (config.model) {
      args.push('--model', config.model);  # Specify model version
    }
    
    if (config.allowedTools?.length) {
      args.push('--allowedTools', config.allowedTools.join(','));  # Pre-approved tools
    }
    
    if (config.systemPrompt) {
      args.push('--system-prompt', config.systemPrompt);  # Custom instructions
    }
    
    # Spawn Claude process with initial prompt as final argument
    const process = spawn('claude', [...args, config.initialPrompt], {
      cwd: config.workingDirectory,  # Set working directory
      env: { ...process.env },  
      stdio: ['pipe', 'pipe', 'pipe']  # We'll handle all I/O streams
    });
    
    # Store process reference for later management
    this.processes.set(sessionId, process);
    
    # Set up event handlers for process output
    this.setupProcessHandlers(sessionId, process);
    
    return sessionId;
  }
  
  private setupProcessHandlers(sessionId: string, process: ChildProcess) {
    # Create parser for JSONL output
    const parser = new JsonLinesParser();
    
    # Pipe stdout through parser
    process.stdout.on('data', (chunk) => {
      parser.write(chunk);  # Parser will emit 'data' events for each complete JSON object
    });
    
    # Handle parsed messages from Claude
    parser.on('data', (message) => {
      this.handleClaudeMessage(sessionId, message);  # Process each message type
    });
    
    # Handle process termination
    process.on('close', (code) => {
      this.handleProcessClose(sessionId, code);  # Clean up and notify clients
    });
    
    # Handle error output
    process.stderr.on('data', (data) => {
      this.handleProcessError(sessionId, data);  # Log errors and notify clients
    });
  }
}
```

### B. JSONL Stream Parser
```typescript
# Custom Transform stream that parses JSONL (newline-delimited JSON)
# Handles partial lines and buffering automatically

class JsonLinesParser extends Transform {
  # Buffer for incomplete lines
  private buffer = '';
  
  _transform(chunk: Buffer, encoding: string, callback: Function) {
    # Append new data to buffer
    this.buffer += chunk.toString();
    
    # Split by newlines but keep last incomplete line in buffer
    let lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';  # Last element might be incomplete
    
    # Parse each complete line
    for (const line of lines) {
      if (line.trim()) {  # Skip empty lines
        try {
          const parsed = JSON.parse(line);
          this.push(parsed);  # Emit parsed object
        } catch (error) {
          this.emit('error', new Error(`Invalid JSON: ${line}`));
        }
      }
    }
    
    callback();  # Signal completion of this chunk
  }
  
  _flush(callback: Function) {
    # Process any remaining data when stream ends
    if (this.buffer.trim()) {
      try {
        const parsed = JSON.parse(this.buffer);
        this.push(parsed);
      } catch (error) {
        this.emit('error', new Error(`Invalid JSON: ${this.buffer}`));
      }
    }
    callback();
  }
}
```

### C. Stream Manager
```typescript
# Manages streaming connections to multiple clients
# Allows broadcasting updates to all clients watching a conversation

class StreamManager {
  # Maps session IDs to sets of connected client responses
  private clients: Map<string, Set<Response>> = new Map();
  
  addClient(sessionId: string, res: Response) {
    # Configure response for streaming
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');  # Prevent proxy buffering
    
    # Initialize client set if needed
    if (!this.clients.has(sessionId)) {
      this.clients.set(sessionId, new Set());
    }
    
    # Add this client to the session
    this.clients.get(sessionId)!.add(res);
    
    # Send initial connection confirmation
    this.sendToClient(res, {
      type: 'connected',
      session_id: sessionId,
      timestamp: new Date().toISOString()
    });
    
    # Clean up when client disconnects
    res.on('close', () => {
      this.clients.get(sessionId)?.delete(res);
    });
  }
  
  broadcast(sessionId: string, event: StreamUpdate) {
    # Send update to all clients watching this session
    const clients = this.clients.get(sessionId);
    if (!clients) return;
    
    for (const client of clients) {
      this.sendToClient(client, event);
    }
  }
  
  private sendToClient(res: Response, message: any) {
    # Format and send newline-delimited JSON message
    # Each message is a complete JSON object followed by newline
    res.write(`${JSON.stringify(message)}\n`);
  }
}
```

### D. History File Reader
```typescript
# Reads conversation history from Claude's local storage
# Claude stores conversations as JSONL files in ~/.claude/projects

class ClaudeHistoryReader {
  # Base path to Claude's data directory
  private claudeHomePath = path.join(os.homedir(), '.claude');
  
  async listConversations(filter?: ConversationFilter): Promise<ConversationSummary[]> {
    # Navigate to projects directory
    const projectsPath = path.join(this.claudeHomePath, 'projects');
    const projects = await fs.readdir(projectsPath);
    
    const conversations: ConversationSummary[] = [];
    
    # Iterate through each project directory
    for (const project of projects) {
      const projectPath = path.join(projectsPath, project);
      const files = await fs.readdir(projectPath);
      
      # Process each JSONL file
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;  # Skip non-conversation files
        
        const sessionId = path.basename(file, '.jsonl');
        const filePath = path.join(projectPath, file);
        
        # First line contains conversation summary
        const firstLine = await this.readFirstLine(filePath);
        const summary = JSON.parse(firstLine);
        
        # Use file stats for timestamps
        const stats = await fs.stat(filePath);
        
        conversations.push({
          sessionId,
          projectPath: this.decodeProjectPath(project),  # Convert back to original path
          summary: summary.summary || 'No summary',
          createdAt: stats.birthtime.toISOString(),
          updatedAt: stats.mtime.toISOString(),
          messageCount: await this.countMessages(filePath)  # Count non-summary lines
        });
      }
    }
    
    # Apply any filters and return results
    return this.applyFilters(conversations, filter);
  }
  
  async fetchConversation(sessionId: string): Promise<ConversationMessage[]> {
    # Find the JSONL file for this session
    const filePath = await this.findConversationFile(sessionId);
    
    # Read entire file content
    const content = await fs.readFile(filePath, 'utf-8');
    
    # Parse each line as JSON, skip summary line
    return content
      .split('\n')
      .filter(line => line.trim())  # Remove empty lines
      .map(line => JSON.parse(line))
      .filter(entry => entry.type !== 'summary');  # Exclude metadata
  }
  
  private decodeProjectPath(encoded: string): string {
    # Claude encodes directory paths by replacing '/' with '-'
    # This reverses that encoding
    return encoded.replace(/-/g, '/');
  }
}
```

### E. MCP Permission Server
```typescript
# Model Context Protocol server that handles permission requests
# This runs as a separate process and communicates with Claude

class CCUIMCPServer {
  # MCP server instance
  private server: McpServer;
  
  # Store pending permission requests
  private pendingRequests: Map<string, PermissionRequest> = new Map();
  
  # Event emitter for communicating with main server
  private eventEmitter = new EventEmitter();
  
  constructor() {
    # Initialize MCP server with metadata
    this.server = new McpServer({
      name: "ccui-permissions",
      version: "1.0.0"
    });
    
    this.setupTools();
  }
  
  private setupTools() {
    # Register the permission prompt tool
    # Claude will call this when it needs permission for another tool
    this.server.tool(
      "permission_prompt",  # Tool name
      {
        # Tool parameters schema
        tool_name: z.string(),       # Which tool needs permission
        input: z.object({}).passthrough(),  # Tool's input parameters
        session_id: z.string()       # Which conversation is asking
      },
      async ({ tool_name, input, session_id }) => {
        # Generate unique ID for this request
        const requestId = generateRequestId();
        
        # Create permission request object
        const request: PermissionRequest = {
          id: requestId,
          sessionId: session_id,
          toolName: tool_name,
          toolInput: input,
          timestamp: new Date().toISOString(),
          status: 'pending'
        };
        
        # Store request for later reference
        this.pendingRequests.set(requestId, request);
        
        # Notify main server about new permission request
        this.eventEmitter.emit('permission-request', request);
        
        # Block until user makes a decision
        const decision = await this.waitForDecision(requestId);
        
        # Return appropriate response to Claude
        if (decision.approved) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                behavior: "allow",
                updatedInput: decision.modifiedInput || input  # User might modify parameters
              })
            }]
          };
        } else {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                behavior: "deny",
                message: decision.reason || "Permission denied by user"
              })
            }]
          };
        }
      }
    );
  }
  
  private async waitForDecision(requestId: string): Promise<any> {
    # Poll for user's decision on permission request
    return new Promise((resolve) => {
      # Check every 100ms for status change
      const checkDecision = setInterval(() => {
        const request = this.pendingRequests.get(requestId);
        if (request && request.status !== 'pending') {
          clearInterval(checkDecision);
          resolve({
            approved: request.status === 'approved',
            modifiedInput: request.modifiedInput,
            reason: request.denyReason
          });
        }
      }, 100);
      
      # Timeout after 5 minutes to prevent hanging
      setTimeout(() => {
        clearInterval(checkDecision);
        resolve({ approved: false, reason: 'Request timeout' });
      }, 300000);
    });
  }
  
  async start() {
    # Start MCP server using stdio transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
```

### F. Main Server Implementation
```typescript
# Main Express server that ties everything together
# This is the entry point for the CCUI backend

class CCUIServer {
  # Core components
  private app: Express;
  private processManager: ClaudeProcessManager;
  private historyReader: ClaudeHistoryReader;
  private streamManager: StreamManager;
  private mcpServer: CCUIMCPServer;
  
  constructor() {
    this.app = express();
    this.setupMiddleware();  # Configure Express middleware
    this.setupRoutes();      # Define API routes
    this.setupMCPIntegration();  # Connect MCP events
  }
  
  private setupRoutes() {
    # Start new conversation endpoint
    this.app.post('/api/conversations/start', async (req, res) => {
      try {
        # Spawn new Claude process with provided configuration
        const sessionId = await this.processManager.startConversation(req.body);
        
        # Return session info for client to connect to stream
        res.json({ 
          sessionId, 
          streamUrl: `/api/stream/${sessionId}` 
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    # Streaming endpoint
    this.app.get('/api/stream/:sessionId', (req, res) => {
      const { sessionId } = req.params;
      # Register this client for updates
      this.streamManager.addClient(sessionId, res);
    });
    
    # List conversations endpoint
    this.app.get('/api/conversations', async (req, res) => {
      # Read conversation history from disk
      const conversations = await this.historyReader.listConversations(req.query);
      res.json({ conversations });
    });
    
    # Get pending permissions endpoint
    this.app.get('/api/permissions', (req, res) => {
      # Filter permissions by query parameters
      const permissions = Array.from(this.mcpServer.pendingRequests.values())
        .filter(p => !req.query.sessionId || p.sessionId === req.query.sessionId);
      res.json({ permissions });
    });
    
    # Handle permission decision endpoint
    this.app.post('/api/permissions/:requestId', (req, res) => {
      # Update permission request with user's decision
      const success = this.mcpServer.handleDecision(
        req.params.requestId,
        req.body.action,
        req.body.modifiedInput
      );
      res.json({ success });
    });
  }
  
  private setupMCPIntegration() {
    # Connect MCP server events to stream broadcasts
    this.mcpServer.on('permission-request', (request) => {
      # When MCP receives permission request, notify all connected clients
      this.streamManager.broadcast(request.sessionId, {
        type: 'permission_request',
        data: request,
        sessionId: request.sessionId,
        timestamp: new Date().toISOString()
      });
    });
  }
}
```

## 4. Implementation Flow

### Starting a Conversation
```
# Step-by-step flow when user starts a new conversation
```
1. Frontend calls `POST /api/conversations/start`
2. Backend spawns Claude CLI process with MCP config
3. Backend returns session ID and stream URL
4. Frontend connects to stream
5. Claude output is parsed and streamed to frontend

### Permission Handling Flow
```
# Flow when Claude needs permission to use a tool
```
1. Claude invokes a tool requiring permission
2. MCP server receives the tool request
3. MCP server creates pending permission request
4. Backend broadcasts permission request via stream
5. Frontend displays permission UI
6. User approves/denies via `POST /api/permissions/:id`
7. MCP server returns decision to Claude
8. Claude continues or stops based on decision

### History Browsing
```
# Flow for viewing past conversations
```
1. Frontend calls `GET /api/conversations`
2. Backend reads `~/.claude/projects` directory
3. Backend parses JSONL files for summaries
4. Returns paginated conversation list
5. Frontend can fetch full conversation via `GET /api/conversations/:id`

## 5. Configuration

### MCP Configuration File
```json
# This file tells Claude about available MCP servers
# Place in project root and reference in CLI args
{
  "mcpServers": {
    "ccui": {
      "command": "node",                    # How to run the MCP server
      "args": ["./mcp-server/index.js"],    # Path to MCP server script
      "env": {
        "CCUI_API_URL": "http://localhost:3001"  # Backend URL for MCP to call
      }
    }
  }
}
```

### Environment Variables
```
# Required environment configuration
PORT=3001                           # Port for CCUI backend server
CLAUDE_HOME_PATH=~/.claude          # Path to Claude data directory
MCP_CONFIG_PATH=./mcp-config.json   # Path to MCP configuration
LOG_LEVEL=info                      # Logging verbosity
```