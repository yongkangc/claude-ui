In this file we define how each tool use (type = tool_use) is rendered in the message list.

Two components are involved to render a tool use:

- the tool use label 
- the tool use block

We use different rendering rules for tools of different name:

### Read

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

- Read({input.file_path(relative to the working directory if it's a subpath)}:{input.offset(optional if zero),offset+input.limit(optional)})
    e.g. Read(./file.txt:10,110), Read(./file.txt), Read(./file.txt:100)
- No block content

### Edit

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

- Label:
Update({input.file_path})
    e.g. Update(./file.txt)
- Content:
```
[red] -{old_string formated}
[green] +{new_string formated}
```
e.g. 
```
[red] -This is the original text
[red] -This is the original text Line 2
[green] +This is the replacement text
[green] +This is the replacement text Line 2
```

### MultiEdit

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

- Label:
MultiEdit({input.file_path})
    e.g. MultiEdit(./file.txt)
- Content:
```
[red] -{edits[0].old_string formated}
[green] +{edits[0].new_string formated}
...
[red] -{edits[1].old_string formated}
[green] +{edits[1].new_string formated}
```

e.g. 
```
MultiEdit(./file.txt)
[red] -This is the original text
[green] +This is the replacement text
...
[red] -This is the original text Line 2
[green] +This is the replacement text Line 2
```

### Bash
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

- Label:
Bash({input.command})
    e.g. Bash(ls -la)
- Content:
The content from it's tool_result message.

### Grep
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