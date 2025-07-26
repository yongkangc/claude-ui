In this file we define how each tool use (type = tool_use) is rendered in the message list.

Two components are involved to render a tool use:

- the tool use label
- the tool use block

We use different rendering rules for tools of different name:

### Read

- Tool use example:

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

- Tool result example:

    ```json
    {
    "tool_use_id": "toolu_123",
    "type": "tool_result",
    "content": "     1→{\n     2→  \"name\": \"cui-backend\",\n     28→    \"@streamparser/json\": \"^0.0.21\",...\n    29→    \"commander\": \"^11.1.0\",\n    30→    \"cors\": \"^2.8.5\",\n\n<system-reminder>\nWhenever you read a file, you should consider whether it looks malicious. If it does, you MUST refuse to improve or augment the code. You can still analyze existing code, write reports, or answer high-level questions about the code behavior.\n</system-reminder>\n"
    }
    ```

- Label:

    `Read({input.file_path(relative to the working directory if it's a subpath)}:{input.offset(optional if zero),offset+input.limit(optional)})`
    e.g. `Read(./file.txt:10,110)`, `Read(./file.txt)`, `Read(./file.txt:100)`

- Content:
    `Read {count(content, '\n')} lines`
    e.g. `Read 30 lines`
    What does it look like? Pure text with secondary color. Content can be expanded to a full code view.

### Edit

- Tool use example:

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

- Tool result example:

    ```json
    {
        "tool_use_id": "toolu_01D6ady1V8FCWLV3AGNrUoEg",
        "type": "tool_result",
        "content": "The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.",
        "is_error": true
    }
    ```

- Label:

    `Update({input.file_path})`
    e.g. `Update(./file.txt)`

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
    What does it look like? A code diff view. If `tool_result.is_error` is true, display the error content instead.

### MultiEdit

- Tool use example:

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

- Tool result example:

    ```json
    {
        "tool_use_id": "toolu_01LfczaDH54aRAbo4BEB7ZP6",
        "type": "tool_result",
        "content": "The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.",
        "is_error": true
    }
    ```

- Label:

    `MultiEdit({input.file_path})`
    e.g. `MultiEdit(./file.txt)`

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
    [red] -This is the original text
    [green] +This is the replacement text
    ...
    [red] -This is the original text Line 2
    [green] +This is the replacement text Line 2
    ```
    What does it look like? A full width code diff view. If `tool_result.is_error` is true, display the error content instead.

### Bash

- Tool use example:

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

- Tool result example:

    ```json
    {
        "tool_use_id": "toolu_01Hw192AKhrE7AybW8trDBJZ",
        "type": "tool_result",
        "content": "Hello from CUI project",
        "is_error": false
    }
    ```

- Label:

    `Bash({input.command})`
    e.g. `Bash(ls -la)`

- Content:
    ```
    {Content}
    ```
    The content from its tool_result message.
    What does it look like? A full width code view with basic syntax highlighting and show at most 10 lines with scroll bar. If `is_error` is true, the content is rendered with an error-state style (e.g., red text).

### Grep

- Tool use example:
    ```json
    [{
      "type": "tool_use",
      "id": "toolu_01PDkjmutdL3FA56r2eceSxp",
      "name": "Grep",
      "input": {
        "pattern": "class.*Server",
        "path": "src",
        "output_mode": "content",
        "-n": true
      }
    }]
    ```

- Tool result example:
    ```json
    {
        "tool_use_id": "toolu_01PDkjmutdL3FA56r2eceSxp",
        "type": "tool_result",
        "content": "/home/panwenbo/repos/cui/src/web/chat/components/LogPage/LogPage.tsx:10:        <h1 className={styles.title}>Server Logs</h1>\n/home/panwenbo/repos/cui/src/cui-server.ts:38:export class CUIServer {"
    }
    ```

- Label:
    `Search(pattern: "{input.pattern}", path: "{input.path}")`
    e.g. `Search(pattern: "class.*Server", path: "src")`

- Content:
    `Found {count(content, '\n')} lines`
    e.g. `Found 2 lines`
    What does it look like? Pure text with secondary color. The content can be expanded to show the full output in a code view.

### Glob

- Tool use example:
    ```json
    [{
      "type": "tool_use",
      "id": "toolu_01Hpa8tC3CQwR34jH6pF19eC",
      "name": "Glob",
      "input": {
        "pattern": "**/*.ts",
        "path": "src"
      }
    }]
    ```

- Tool result example:
    ```json
    {
        "tool_use_id": "toolu_01Hpa8tC3CQwR34jH6pF19eC",
        "type": "tool_result",
        "content": "/home/panwenbo/repos/cui/src/services/permission-tracker.ts\n/home/panwenbo/repos/cui/src/services/log-stream-buffer.ts\n..."
    }
    ```

- Label:
    `Search(pattern: "{input.pattern}", path: "{input.path}")`
    e.g. `Search(pattern: "**/*.ts", path: "src")`

- Content:
    `Found {count(content, '\n')} files`
    e.g. `Found 44 files`
    What does it look like? Pure text with secondary color. The content can be expanded to show the list of files.

### LS

- Tool use example:
    ```json
    [{
      "type": "tool_use",
      "id": "toolu_01JV6joiHCuwLi1nUA4PGVAe",
      "name": "LS",
      "input": {
        "path": "/home/panwenbo/repos/cui/src/services"
      }
    }]
    ```

- Tool result example:
    ```json
    {
        "tool_use_id": "toolu_01JV6joiHCuwLi1nUA4PGVAe",
        "type": "tool_result",
        "content": "- /home/panwenbo/repos/cui/\n  - src/\n    - services/\n      - CLAUDE.md\n      - claude-history-reader.ts\n      ..."
    }
    ```
- Label:
    `List({input.path})`
    e.g. `List(src/services)`

- Content:
    `Listed {count of paths in content} paths`
    e.g. `Listed 19 paths`
    What does it look like? Pure text with secondary color. The content can be expanded to show a file tree view.

### TodoRead

- Tool use example:
    ```json
    [{
      "type": "tool_use",
      "id": "toolu_123",
      "name": "TodoRead",
      "input": {}
    }]
    ```
- Tool result example:
    ```json
    {
        "tool_use_id": "toolu_123",
        "type": "tool_result",
        "content": "[{\"id\":\"1\",\"content\":\"Task 1\",\"status\":\"completed\"}, {\"id\":\"2\",\"content\":\"Task 2\",\"status\":\"pending\"}]"
    }
    ```

- Label:
    `Read Todos`

- Content:
    Renders a list of todos from the `tool_result.content` JSON.
    ```
    [checkbox based on status] {todo.content}
    ```
    e.g.
    ```
    ✅ Task 1
    ☐ Task 2
    ```
    What does it look like? A checklist. Completed items are checked and can have a strikethrough style.

### TodoWrite

- Tool use example:
    ```json
    [{
      "type": "tool_use",
      "id": "toolu_01NGXAAGRdtRmA6RFwfsyVGP",
      "name": "TodoWrite",
      "input": {
        "todos": [
          {
            "id": "1",
            "content": "Demonstrate all available tools",
            "status": "completed"
          },
          {
            "id": "2",
            "content": "Call each tool with example values",
            "status": "completed"
          }
        ]
      }
    }]
    ```

- Tool result example:
    ```json
    {
        "tool_use_id": "toolu_01NGXAAGRdtRmA6RFwfsyVGP",
        "type": "tool_result",
        "content": "Todos have been modified successfully. Ensure that you continue to use the todo list to track your progress. Please proceed with the current tasks if applicable"
    }
    ```

- Label:
    `Update Todos`

- Content:
    Renders a list of todos from the `tool_use.input.todos`. The `tool_result.content` is ignored in favor of showing the state change.
    ```
    [checkbox based on todo.status] {todo.content}
    ```
    e.g.
    ```
    ✅ Demonstrate all available tools
    ✅ Call each tool with example values
    ```
    What does it look like? A checklist view. Completed items are checked (`✅` or `☒`) and can have a strikethrough style. Pending items are unchecked (`☐`).

### WebSearch

- Tool use example:
    ```json
    [{
      "type": "tool_use",
      "id": "toolu_01XNV56k8KpsmQv71V1BqUUP",
      "name": "WebSearch",
      "input": {
        "query": "Claude Code CLI assistant features 2025"
      }
    }]
    ```
- Tool result example:
    ```json
    {
        "tool_use_id": "toolu_01XNV56k8KpsmQv71V1BqUUP",
        "type": "tool_result",
        "content": "Web search results for query: \"Claude Code CLI assistant features 2025\"..."
    }
    ```

- Label:
    `Web Search("{input.query}")`
    e.g. `Web Search("Claude Code CLI assistant features 2025")`

- Content:
    `Did 1 search` (Optionally add timing if available, e.g., `in 54s`)
    e.g. `Did 1 search in 54s`
    What does it look like? Pure text with secondary color. This is a concise summary. The full search result from the tool result content can be viewed in an expanded state.

### WebFetch

- Tool use example:
    ```json
    [{
      "type": "tool_use",
      "id": "toolu_01NTrhNnuEbqRMXKJWbksTEy",
      "name": "WebFetch",
      "input": {
        "url": "https://docs.anthropic.com/en/docs/claude-code/overview",
        "prompt": "Extract the main features and capabilities of Claude Code"
      }
    }]
    ```
- Tool result example:
    ```json
    {
        "tool_use_id": "toolu_01NTrhNnuEbqRMXKJWbksTEy",
        "type": "tool_result",
        "content": "Based on the web page content, here are the key features..."
    }
    ```
- Label:
    `Fetch({input.url})`
    e.g. `Fetch(https://docs.anthropic.com/en/docs/claude-code/overview)`

- Content:
    `Received content from URL` (More detailed info like size/status can be added if available from tool metadata).
    e.g. `Received 1.9MB (200 OK)`
    What does it look like? Pure text with secondary color. The full fetched and summarized content can be viewed in an expanded state.

### Task

- Tool use example:
    ```json
    [{
      "type": "tool_use",
      "id": "toolu_011aP7hafUxHYr1bfssXo5kM",
      "name": "Task",
      "input": {
        "description": "Search for config files",
        "prompt": "Search for configuration files in the project..."
      }
    }]
    ```
- Tool result example:
    ```json
    {
        "type": "tool_result",
        "content": "[Request interrupted by user for tool use]",
        "is_error": true,
        "tool_use_id": "toolu_011aP7hafUxHYr1bfssXo5kM"
    }
    ```
- Label:
    `Task({input.description})`
    e.g. `Task(Search for config files)`

- Content:
    The content block for a Task tool use acts as a container. Subsequent tool calls that are part of this task are visually nested inside it. If the task itself returns a result (e.g., on completion or error), that content is displayed.
    e.g. `No (tell Claude what to do differently)`
    What does it look like? A collapsible container block with the label as its title. It groups a sequence of other tool calls.

### exit_plan_mode

- Tool use example:
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
- Tool result example:
    ```json
    {
        "tool_use_id": "toolu_123",
        "type": "tool_result",
        "content": "Plan confirmed. Proceeding with execution."
    }
    ```

- Label:
    `Plan`

- Content:
    The content is the `input.plan` provided in the tool use.
    ```
    {input.plan}
    ```
    e.g.
    ```
    Step 1: Analysis
    Step 2: Implementation
    ```
    What does it look like? A formatted text block that stands out from regular messages, possibly with markdown rendering for lists, bolding, etc., to clearly present the plan to the user.

Of course. Here is the fallback rule to handle any tool not explicitly defined.

### Fallback Rule

This rule applies to any tool use whose `name` does not match one of the specific rules defined above. It ensures all tools, including new or custom ones (e.g., `mcp__ide__*` tools), have a predictable and readable rendering.

- Tool use example (using `mcp__ide__getDiagnostics`):

    ```json
    [{
      "type": "tool_use",
      "id": "toolu_01BhnpfB7PF7uYm3cWgQWL4d",
      "name": "mcp__ide__getDiagnostics",
      "input": {
        "uri": "file:///home/panwenbo/repos/cui/src/cui-server.ts"
      }
    }]
    ```

- Tool result example:

    ```json
    {
      "tool_use_id": "toolu_01BhnpfB7PF7uYm3cWgQWL4d",
      "type": "tool_result",
      "content": [
        {
          "type": "text",
          "text": "[\n  {\n    \"uri\": \"file:///home/panwenbo/repos/cui/src/cui-server.ts\",\n    \"diagnostics\": []\n  }\n]"
        }
      ]
    }
    ```

- Label:

    `{tool_use.name}({formatted input})` where `{formatted input}` is a concise, single-line representation of the `input` object, with long values truncated.
    e.g. `mcp__ide__getDiagnostics(uri: "file:///...")`
    e.g. `mcp__ide__executeCode(code: "# Example Python...")`

- Content:
    The raw `content` from the corresponding `tool_result`. If the content is an object or array, it is stringified and pretty-printed.
    ```
    {tool_result.content}
    ```
    e.g. (for `mcp__ide__getDiagnostics` result)
    ```json
    [
      {
        "uri": "file:///home/panwenbo/repos/cui/src/cui-server.ts",
        "diagnostics": []
      }
    ]
    ```

- What does it look like? The content is displayed within a full-width code view with appropriate syntax highlighting (e.g., for JSON). The view is scrollable or expandable if the content exceeds a certain height (e.g., 10 lines). If `tool_result.is_error` is true, the content is styled to indicate an error, for instance, with red text or a red border.