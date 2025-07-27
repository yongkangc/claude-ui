# Claude Message Content Structure Reference

## Overview

This document catalogs all possible message content structures found in Claude conversations. The `content` field within each message can take various forms depending on the type of interaction, ranging from simple text to complex tool usage patterns.

## Example Conversation Structure

A typical Claude conversation turn has this overall structure:
```json
{
  "message": {
    "id": "msg_01ABC123",
    "role": "assistant",
    "content": [/* Various content structures documented below */],
    "model": "claude-3-5-sonnet-20241022",
    "stop_reason": "end_turn",
    "stop_sequence": null,
    "usage": {
      "input_tokens": 1234,
      "output_tokens": 567
    }
  }
}
```

The `content` field is what varies and contains the actual message data, which can be one of the 50+ different structures documented below.

## Content Structure Categories

### 1. Text Content

#### Simple String Content
```json
"Hello, how can I help you?"
```

#### Structured Text Content
```json
[{
  "type": "text",
  "text": "Hello, how can I help you?"
}]
```

### 2. Tool Usage Messages

#### Basic Tool Use
```json
[{
  "type": "tool_use",
  "id": "toolu_123",
  "name": "Read",
  "input": {
    "file_path": "/path/to/file"
  }
}]
```

#### Tool Use with All Parameters
```json
[{
  "type": "tool_use",
  "id": "toolu_123", 
  "name": "Read",
  "input": {
    "file_path": "/path/to/file",
    "offset": 10,
    "limit": 100
  }
}]
```

#### Complex Tool Usage Examples

**File Operations:**
```json
[{
  "type": "tool_use",
  "id": "toolu_123",
  "name": "Edit",
  "input": {
    "file_path": "/path/to/file",
    "old_string": "original text",
    "new_string": "replacement text"
  }
}]
```

**Multi-Edit Operations:**
```json
[{
  "type": "tool_use",
  "id": "toolu_123",
  "name": "MultiEdit", 
  "input": {
    "file_path": "/path/to/file",
    "edits": [
      {
        "old_string": "text1",
        "new_string": "replacement1"
      },
      {
        "old_string": "text2", 
        "new_string": "replacement2"
      }
    ]
  }
}]
```

**Shell Commands:**
```json
[{
  "type": "tool_use",
  "id": "toolu_123",
  "name": "Bash",
  "input": {
    "command": "ls -la",
    "description": "List directory contents"
  }
}]
```

**Search Operations:**
```json
[{
  "type": "tool_use",
  "id": "toolu_123",
  "name": "Grep", 
  "input": {
    "pattern": "searchterm",
    "path": "/search/directory"
  }
}]
```

```json
[{
  "type": "tool_use",
  "id": "toolu_123",
  "name": "Grep",
  "input": {
    "pattern": "searchterm",
    "path": "/search/directory", 
    "include": "*.js"
  }
}]
```

**File System Operations:**
```json
[{
  "type": "tool_use",
  "id": "toolu_123",
  "name": "Glob",
  "input": {
    "pattern": "**/*.py",
    "path": "/project/root"
  }
}]
```

```json
[{
  "type": "tool_use",
  "id": "toolu_123",
  "name": "LS",
  "input": {
    "path": "/directory/path"
  }
}]
```

**Task Management:**
```json
[{
  "type": "tool_use",
  "id": "toolu_123",
  "name": "TodoRead",
  "input": {}
}]
```

```json
[{
  "type": "tool_use",
  "id": "toolu_123", 
  "name": "TodoWrite",
  "input": {
    "todos": [
      {
        "id": "1",
        "content": "Task description",
        "status": "pending",
        "priority": "high"
      }
    ]
  }
}]
```

**Web Operations:**
```json
[{
  "type": "tool_use",
  "id": "toolu_123",
  "name": "WebSearch",
  "input": {
    "query": "search terms"
  }
}]
```

```json
[{
  "type": "tool_use", 
  "id": "toolu_123",
  "name": "WebFetch",
  "input": {
    "url": "https://example.com",
    "prompt": "Extract main content"
  }
}]
```

**Agent Delegation:**
```json
[{
  "type": "tool_use",
  "id": "toolu_123",
  "name": "Task",
  "input": {
    "description": "Search for files",
    "prompt": "Find all Python files containing 'class' definitions"
  }
}]
```

**Planning Mode:**
```json
[{
  "type": "tool_use",
  "id": "toolu_123",
  "name": "exit_plan_mode",
  "input": {
    "plan": "Step 1: Analysis\nStep 2: Implementation"
  }
}]
```

### 3. Tool Results

#### Basic Tool Result
```json
[{
  "tool_use_id": "toolu_123",
  "type": "tool_result",
  "content": "Operation completed successfully"
}]
```

#### Tool Result with Error Status
```json
[{
  "tool_use_id": "toolu_123", 
  "type": "tool_result",
  "content": "File not found",
  "is_error": false
}]
```

#### Tool Result with Error
```json
[{
  "tool_use_id": "toolu_123",
  "type": "tool_result", 
  "content": "Permission denied",
  "is_error": true
}]
```

### 4. Mixed Content Types

#### Text + Tool Use
```json
[
  {
    "type": "text",
    "text": "I'll help you with that file. Let me read it first:"
  },
  {
    "type": "tool_use",
    "id": "toolu_123",
    "name": "Read",
    "input": {
      "file_path": "/path/to/file"
    }
  }
]
```

#### Multiple Tool Uses
```json
[
  {
    "type": "tool_use",
    "id": "toolu_123",
    "name": "Read", 
    "input": {
      "file_path": "/file1"
    }
  },
  {
    "type": "tool_use",
    "id": "toolu_124",
    "name": "Read",
    "input": {
      "file_path": "/file2" 
    }
  }
]
```

### 5. Extended Thinking Content

#### Thinking Block
```json
[{
  "type": "thinking",
  "thinking": "Let me analyze this problem step by step...",
  "signature": "signature_hash_123"
}]
```

#### Redacted Thinking
```json
[{
  "type": "redacted_thinking", 
  "data": "encrypted_thinking_content"
}]
```

### 6. Specialized Content Types

#### Server Tool Use
```json
[{
  "type": "server_tool_use",
  "id": "server_123",
  "name": "web_search",
  "input": {
    "query": "search terms"
  }
}]
```

#### Web Search Results
```json
[{
  "type": "web_search_tool_result",
  "tool_use_id": "toolu_123",
  "content": [
    {
      "type": "web_search_result",
      "title": "Page Title",
      "url": "https://example.com",
      "encrypted_content": "encrypted_content_hash"
    }
  ]
}]
```

## Parameter Patterns

### Required vs Optional Parameters
- **Required only**: Minimal tool usage with just essential parameters
- **Full parameter sets**: Tools used with all available optional parameters
- **Mixed usage**: Some optional parameters included, others omitted

### Data Types
- **Strings**: File paths, commands, descriptions, content
- **Numbers**: Offsets, limits, counts, indices  
- **Booleans**: Error flags, configuration options
- **Arrays**: Lists of edits, todos, search results
- **Objects**: Complex nested structures for advanced tool inputs
- **Empty objects**: Tools that require no input parameters

### Error Handling
- **Success responses**: Normal tool result content
- **Error responses**: Tool results with `is_error: true`
- **Malformed requests**: Tools called with incorrect parameter formats

## Usage Notes

1. **Simple text**: Used for basic conversational responses
2. **Tool use**: For executing specific operations (file I/O, searches, etc.)
3. **Tool results**: Responses from tool executions
4. **Mixed content**: Combining explanation text with tool usage
5. **Thinking blocks**: Internal reasoning when extended thinking is enabled
6. **Parallel operations**: Multiple tools called simultaneously for efficiency

This structure reference covers all observed message content patterns in Claude conversations, providing a comprehensive guide for understanding and working with Claude's message format.