# Type Definitions

This directory contains centralized TypeScript type definitions for CCUI backend.

## Content Block System

```typescript
// Core content types from Anthropic SDK
export type ContentBlock =
  | TextBlock
  | ToolUseBlock
  | ServerToolUseBlock
  | WebSearchToolResultBlock
  | ThinkingBlock
  | RedactedThinkingBlock;

export type ContentBlockParam =
  | ServerToolUseBlockParam
  | WebSearchToolResultBlockParam
  | TextBlockParam
  | ImageBlockParam
  | ToolUseBlockParam
  | ToolResultBlockParam
  | DocumentBlockParam
  | ThinkingBlockParam
  | RedactedThinkingBlockParam;

export interface TextBlock {
  type: 'text';
  text: string;
  citations?: Array<TextCitation> | null;
}

export interface TextBlockParam {
  text: string;
  type: 'text';
  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;
  citations?: Array<TextCitationParam> | null;
}

export interface ImageBlockParam {
  source: Base64ImageSource | URLImageSource;
  type: 'image';
  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;
}

export interface Base64ImageSource {
  data: string;
  media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  type: 'base64';
}

export interface URLImageSource {
  type: 'url';
  url: string;
}

export interface DocumentBlockParam {
  source: Base64PDFSource | PlainTextSource | ContentBlockSource | URLPDFSource;
  type: 'document';
  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;
  citations?: CitationsConfigParam;
  context?: string | null;
  title?: string | null;
}

export interface Base64PDFSource {
  data: string;
  media_type: 'application/pdf';
  type: 'base64';
}

export interface URLPDFSource {
  type: 'url';
  url: string;
}

export interface PlainTextSource {
  data: string;
  media_type: 'text/plain';
  type: 'text';
}

export interface ContentBlockSource {
  content: string | Array<ContentBlockSourceContent>;
  type: 'content';
}

export type ContentBlockSourceContent = TextBlockParam | ImageBlockParam;

export interface CitationsConfigParam {
  enabled?: boolean;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

export interface ToolUseBlockParam {
  id: string;
  input: unknown;
  name: string;
  type: 'tool_use';
  cache_control?: CacheControlEphemeral | null;
}

export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
  signature: string;
}

export interface ThinkingBlockParam {
  signature: string;
  thinking: string;
  type: 'thinking';
}

export interface RedactedThinkingBlock {
  type: 'redacted_thinking';
  data: string;
}

export interface RedactedThinkingBlockParam {
  data: string;
  type: 'redacted_thinking';
}

export interface ServerToolUseBlock {
  type: 'server_tool_use';
  id: string;
  name: 'web_search';
  input: unknown;
}

export interface ServerToolUseBlockParam {
  id: string;
  input: unknown;
  name: 'web_search';
  type: 'server_tool_use';
  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;
}

export interface WebSearchToolResultBlock {
  content: WebSearchToolResultBlockContent;
  tool_use_id: string;
  type: 'web_search_tool_result';
}

export interface WebSearchToolResultBlockParam {
  content: WebSearchToolResultBlockParamContent;
  tool_use_id: string;
  type: 'web_search_tool_result';
  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;
}

export interface ToolResultBlockParam {
  tool_use_id: string;
  type: 'tool_result';
  content?: string | Array<TextBlockParam | ImageBlockParam>;
  is_error?: boolean;
}

export type StopReason = 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | 'pause_turn' | 'refusal';

## Stream Message Types

Those are only presented at from the streaming output of cc. See `../../../cc-workfiles/knowledge/example-cc-stream-json.jsonl` to understand the structure of the streaming output.

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
  session_id: string;           // Claude CLI's session ID
}

export interface UserStreamMessage {
  type: 'user';
  message: {
    role: 'user';
    content: Array<ContentBlockParam>;
  };
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


## API Request/Response Types

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

## Core Message Types (From Anthropic)

export interface Message {
  id: string;
  content: Array<ContentBlock>;

  /**
   * The model that completed the prompt.
   */
  model: string;

  /**
   * Conversational role of the generated message.
   * This will always be "assistant".
   */
  role: 'assistant';

  /**
   * The reason that we stopped.
   * - "end_turn": model reached a natural stopping point
   * - "max_tokens": exceeded the requested max_tokens or model's maximum
   * - "stop_sequence": one of your provided custom stop_sequences was generated
   * - "tool_use": model invoked one or more tools
   */
  stop_reason: StopReason | null;

  /**
   * Which custom stop sequence was generated, if any.
   */
  stop_sequence: string | null;

  /**
   * Object type. For Messages, this is always "message".
   */
  type: 'message';

  /**
   * Billing and rate-limit usage.
   */
  usage: Usage;
}

export interface MessageParam {
  content: string | Array<ContentBlockParam>;
  role: 'user' | 'assistant';
}

export interface Usage {
  cache_creation_input_tokens: number | null;
  cache_read_input_tokens: number | null;
  input_tokens: number;
  output_tokens: number;
  server_tool_use: ServerToolUsage | null;
  service_tier: 'standard' | 'priority' | 'batch' | null;
}

export interface ServerToolUsage {
  web_search_requests: number;
}

export interface CacheControlEphemeral {
  type: 'ephemeral';
}

## Configuration Types

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

## Stream Event Types

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

## Tool Definitions and Patterns

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