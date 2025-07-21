# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the ToolRendering component system.

## Tool Rendering Architecture

The ToolRendering system provides specialized UI components for rendering different Claude tool outputs in the chat interface. It follows a modular pattern where each tool type has its own dedicated renderer component.

### Core Components

- **ToolUseRenderer** (`ToolUseRenderer.tsx`) - Main orchestrator that renders tool use blocks with their results
- **ToolLabel** (`ToolLabel.tsx`) - Displays tool name, input parameters, and working directory context
- **ToolContent** (`ToolContent.tsx`) - Routes to appropriate tool-specific renderer based on tool name

### Tool-Specific Renderers

Each tool has a dedicated renderer in the `tools/` directory:

- **BashTool** - Command execution with syntax-highlighted output
- **EditTool** - File modifications with before/after diff display
- **ReadTool** - File content display with syntax highlighting
- **SearchTool** - Search results with file paths and match highlights
- **TaskTool** - Subprocess task execution status
- **TodoTool** - Task list management with status indicators
- **WebTool** - Web content fetching and display
- **PlanTool** - Planning phase output formatting
- **FallbackTool** - Generic renderer for unsupported tool types

### Key Patterns

**Tool Interface Pattern:**
```typescript
interface ToolProps {
  input: any;           // Tool input parameters
  result: string;       // Tool execution result
  isError: boolean;     // Error status
  isPending: boolean;   // Loading status
}
```

**Conditional Rendering:**
- All tools handle pending state with loading indicators
- Error states are styled differently (red backgrounds, error icons)
- Results are formatted according to tool type (code blocks, diffs, lists)

**File Path Formatting:**
- Uses `formatFilePath` utility from `../../utils/tool-utils.ts`
- Converts absolute paths to relative when within working directory
- Shows `~/` prefix for user home directory paths

### Styling Architecture

**CSS Modules Pattern:**
- Main styles in `ToolRendering.module.css`
- Shared classes: `toolContent`, `codeBlock`, `errorCode`, `pendingContent`
- Loading spinner animations and scrollable code containers

**Theme Integration:**
- Uses CSS custom properties from global theme system
- Dark/light mode support through theme variables
- Consistent spacing and color schemes

### Working Directory Context

The system is aware of the current working directory context:

- File paths are displayed relative to working directory when possible
- Tool labels show working directory context
- Path formatting utilities handle cross-platform path normalization

### Tool Content Routing

The `ToolContent` component uses a switch statement to route to appropriate renderers:

```typescript
switch (toolName) {
  case 'Bash': return <BashTool {...props} />;
  case 'Edit': return <EditTool {...props} />;
  // ... other tools
  default: return <FallbackTool {...props} />;
}
```

### Adding New Tool Renderers

To add support for a new tool:

1. Create new component in `tools/` directory following naming convention
2. Implement the standard `ToolProps` interface
3. Add case to `ToolContent.tsx` switch statement
4. Handle pending, error, and success states appropriately
5. Use shared CSS classes from `ToolRendering.module.css`

### Implementation Notes

**Result Format Handling:**
- Tool results can be strings or complex objects
- JSON results are formatted and syntax-highlighted
- Large outputs are made scrollable to prevent UI overflow

**Error Boundaries:**
- Individual tool renderers handle their own errors gracefully
- Fallback to generic display if specific renderer fails
- Console logging for debugging tool rendering issues

**Performance Considerations:**
- Components are lightweight and stateless
- No expensive operations in render methods
- Efficient re-rendering through proper key usage

### Integration Points

**Message System Integration:**
- Receives tool use and tool result blocks from message parsing
- Works with Claude's content block structure from Anthropic SDK
- Handles streaming updates where tool results arrive after tool use

**API Integration:**
- Tool results come from backend streaming JSONL format
- Status tracking (pending/completed/error) managed at conversation level
- Working directory information provided by backend conversation context

### Common Patterns

**Loading States:**
All tools show a spinner with "Executing..." or tool-specific loading text when `isPending` is true.

**Error Display:**
Error states use consistent red styling with error icons and preserve the error message content.

**Code Formatting:**
Tools that display code (Bash, Edit, Read) use syntax highlighting and scrollable containers with proper whitespace preservation.

**File Path Display:**
File paths are consistently formatted using the `formatFilePath` utility to show relative paths when possible.