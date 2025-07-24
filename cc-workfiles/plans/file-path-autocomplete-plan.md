# File Path Autocomplete Implementation Plan

## Context
This plan implements a file path autocomplete system for the Composer component in CCUI (Claude Code Web UI). The system allows users to type "@" followed by a file path and get autocomplete suggestions from the filesystem.

## Expected Behavior
1. **Trigger**: When "@" is typed, dropdown appears immediately
2. **Live Filtering**: As user types after "@", dropdown updates with filtered paths
3. **Enter Key**: Selects the first candidate in the list
4. **Arrow Navigation**: Up/Down arrows to move focus between textarea and dropdown candidates
5. **Space Key**: Closes the autocomplete dropdown
6. **Enter on Candidate**: Replaces text from "@" to cursor with selected path

## Implementation Architecture

### 1. State Management in Composer

The autocomplete state will be managed in the Composer component:

```typescript
interface AutocompleteState {
  isActive: boolean;        // Whether autocomplete is currently active
  triggerIndex: number;     // Position of "@" in text
  query: string;            // Path text after "@" (e.g., "src/components/Button")
  suggestions: FileSystemEntry[];  // Array of file/directory suggestions
  // focusedIndex: number;     focused index is managed by the dropdown selector
  isDropdownFocused: boolean;        // Whether the dropdown is focused

}
```

### 2. Keyboard Event Handling

Modify the existing `handleKeyDown` function in Composer.tsx to handle autocomplete navigation:

// ALL CODE FOR REFERENCE ONLY

```typescript
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (autocomplete.isActive) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        // Move focus from textarea to first suggestion or next suggestion
        setAutocomplete(prev => ({
          ...prev,
          focusedIndex: Math.min(prev.focusedIndex + 1, prev.suggestions.length - 1)
        }));
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        // Move focus back towards textarea
        setAutocomplete(prev => ({
          ...prev,
          focusedIndex: Math.max(prev.focusedIndex - 1, -1)
        }));
        break;
        
      case 'Enter':
        e.preventDefault();
        if (autocomplete.focusedIndex === -1) {
          // In textarea, select first suggestion
          if (autocomplete.suggestions.length > 0) {
            handlePathSelection(autocomplete.suggestions[0].name);
          }
        } else {
          // Select focused suggestion
          handlePathSelection(autocomplete.suggestions[autocomplete.focusedIndex].name);
        }
        break;
        
      case ' ':
        // Space closes autocomplete and continues normal typing
        resetAutocomplete();
        break;
        
      case 'Escape':
        e.preventDefault();
        resetAutocomplete();
        break;
    }
  } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    // Existing submit logic remains unchanged
    e.preventDefault();
    handleSubmit(e as any);
  }
};
```

### 3. Text Change Detection

The autocomplete system activates when the user types "@" and updates as they continue typing:

```typescript
const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  const newText = e.target.value;
  const cursorPos = e.target.selectionStart;
  
  setText(newText);
  adjustTextareaHeight();
  
  // Detect @ trigger
  const trigger = detectAutocomplete(newText, cursorPos);
  
  if (trigger) {
    // Start or update autocomplete
    setAutocomplete({
      isActive: true,
      triggerIndex: trigger.index,
      query: trigger.query,
      suggestions: [], // Will be updated by useEffect
      focusedIndex: -1
    });
  } else {
    // Close autocomplete if no valid trigger found
    resetAutocomplete();
  }
};

const detectAutocomplete = (text: string, cursorPos: number) => {
  const beforeCursor = text.substring(0, cursorPos);
  const lastAtIndex = beforeCursor.lastIndexOf('@');
  
  if (lastAtIndex === -1) return null;
  
  const afterAt = beforeCursor.substring(lastAtIndex + 1);
  
  // Check if still valid (no spaces - spaces close autocomplete)
  if (afterAt.includes(' ')) return null;
  
  return {
    index: lastAtIndex,
    query: afterAt
  };
};
```

### 4. API Integration with Debouncing

The system will use the existing filesystem API to fetch file suggestions:

The api are called each time composer is focused.

```typescript
      const response = await api.listDirectory({
        path: {...workingDirectory},
        recursive: true,
        respectGitignore: true
      });
```

### 5. Dropdown Rendering

The dropdown uses the existing DropdownSelector component but without an input field:

```typescript
{autocomplete.isActive && autocomplete.suggestions.length > 0 && (
  <div className={styles.autocompleteWrapper}>
    <DropdownSelector
      options={autocomplete.suggestions.map((entry) => ({
        value: entry.name,
        label: entry.name,
        disabled: false
      }))}
      value={undefined} // No pre-selected value
      onChange={handlePathSelection}
      isOpen={true}
      onOpenChange={(open) => {
        if (!open) resetAutocomplete();
      }}
      showFilterInput={false} // Critical: no input bar
      maxVisibleItems={10}
      className={styles.pathAutocomplete}
    />
  </div>
)}
```

### 6. Path Selection Handler

When a path is selected, it replaces the text from "@" to the cursor:

```typescript
const handlePathSelection = (selectedPath: string) => {
  const { triggerIndex } = autocomplete;
  const cursorPos = textareaRef.current?.selectionStart || 0;
  
  // Replace from @ to cursor with selected path
  // Example: "Hello @src/comp" becomes "Hello @src/components/Button.tsx"
  const newText = 
    text.substring(0, triggerIndex + 1) + // Keep the @ symbol
    selectedPath + 
    text.substring(cursorPos);
  
  setText(newText);
  
  // Reset autocomplete state
  resetAutocomplete();
  
  // Focus back to textarea and position cursor after inserted path
  setTimeout(() => {
    const newCursorPos = triggerIndex + 1 + selectedPath.length;
    textareaRef.current?.focus();
    textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
  }, 0);
};

const resetAutocomplete = () => {
  setAutocomplete({
    isActive: false,
    triggerIndex: -1,
    query: '',
    suggestions: [],
    focusedIndex: -1
  });
};
```

## CSS Positioning

The dropdown will be positioned above the textarea using absolute positioning:

```css
.autocompleteWrapper {
  position: absolute;
  bottom: 100%;           /* Position above the textarea */
  left: 0;
  right: 0;
  margin-bottom: 4px;     /* Small gap between dropdown and textarea */
  z-index: 1000;          /* Ensure it appears above other elements */
}

.pathAutocomplete {
  /* Additional styling if needed */
}
```

## Files to Modify

### 1. API Integration
- **File**: `src/web/chat/services/api.ts`
- **Changes**: Add `listDirectory()` method that calls `/api/filesystem/list`

```typescript
async listDirectory(params: FileSystemListQuery): Promise<FileSystemListResponse> {
  const searchParams = new URLSearchParams();
  searchParams.append('path', params.path);
  if (params.recursive !== undefined) searchParams.append('recursive', params.recursive.toString());
  if (params.respectGitignore !== undefined) searchParams.append('respectGitignore', params.respectGitignore.toString());
  
  return this.apiCall(`/api/filesystem/list?${searchParams}`);
}
```

### 2. Type Exports
- **File**: `src/web/chat/types/index.ts`
- **Changes**: Export filesystem types from backend

```typescript
export type {
  // ... existing exports ...
  FileSystemEntry,
  FileSystemListQuery,
  FileSystemListResponse,
} from '@/types';
```

### 3. Main Implementation
- **File**: `src/web/chat/components/Home/Composer.tsx`
- **Changes**: Add autocomplete state, handlers, and dropdown rendering

### 4. Styling
- **File**: `src/web/chat/components/Home/Composer.module.css`  
- **Changes**: Add styles for autocomplete positioning

## Key Implementation Notes

### Focus Management
- `isDropdownFocused = true`: Focus is in the dropdown
- `isDropdownFocused = false`: Focus is in the textarea

### Space Key Behavior
- Typing space closes the dropdown immediately
- This allows users to naturally end autocomplete by typing a space
- Normal text input continues after space is typed

### Enter Key Logic
- **When focus is in textarea** (focusedIndex = -1): Select the first suggestion
- **When focus is on a suggestion**: Select that specific suggestion
- This provides flexibility for both keyboard-only and mixed interaction

### Path Resolution Strategy
- The system parses the query after "@" to determine:
- No resolution as we are delegating the resolution to the dropdown selector.

### Performance Considerations
- **Result Limiting**: Only show top 5 results to keep dropdown manageable
- **Error Handling**: Failed API calls don't break the user experience

## Testing Strategy

### Unit Tests
1. Test `detectAutocomplete()` function with various input scenarios
2. Test keyboard navigation state transitions
3. Test path selection and text replacement logic
4. Test API integration with mock responses

### Edge Cases to Test
1. Multiple "@" symbols in text
2. Cursor movement away from "@" area
3. Empty directories
4. Permission errors accessing directories
6. Special characters in file names

Following is a high level overview of the current code.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CCUI (Claude Code Web UI) is a web interface for the Claude CLI tool. It consists of:
- TypeScript Express backend that manages Claude CLI processes
- React frontend with TUI-inspired design
- Single-port architecture using vite-express (port 3001)
- Real-time streaming of Claude responses via newline-delimited JSON
- MCP (Model Context Protocol) integration for permission management

## Essential Commands

### Development
```bash
npm run dev          # Start dev server (backend + frontend on port 3001)
npm run build        # Build both frontend and backend
npm run test         # Run all tests
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint checking
```

### Testing
```bash
npm run test                # Run all tests
npm run unit-tests          # Run unit tests only
npm run integration-tests   # Run integration tests only
npm run test:coverage       # Generate coverage report
npm run test:watch          # Watch mode for TDD
```

### Running a Single Test
```bash
npx jest tests/unit/services/ClaudeProcessManager.test.ts  # Run specific test file
npx jest -t "test name"                                    # Run test by name pattern
```

## Architecture Overview

### Backend Services (`src/services/`)
- **ClaudeProcessManager**: Spawns and manages Claude CLI processes
- **StreamManager**: Handles HTTP streaming connections for real-time updates
- **ClaudeHistoryReader**: Reads conversation history from ~/.claude directory
- **CCUIMCPServer**: MCP server for handling tool permission requests
- **SessionInfoService**: Manages extended session metadata (pinning, archiving, continuation sessions, git HEAD tracking)

### Frontend (`src/web/`)
- **chat/**: Main chat application components
- **console/**: Console/log viewer components  
- **api/**: API client using fetch for backend communication
- **styles/**: CSS modules with TUI-inspired design

### API Routes (`src/routes/`)
- Conversations API: Start, list, get, continue, stop conversations
- Streaming API: Real-time conversation updates
- Permissions API: MCP permission approval/denial
- System API: Status and available models

### Key Patterns

1. **Streaming Architecture**: Uses newline-delimited JSON (not SSE) for real-time updates
2. **Process Management**: Each conversation runs as a separate Claude CLI child process
3. **Error Handling**: Custom error types in `src/types/errors.ts` with proper HTTP status codes
4. **Type Safety**: Zod schemas for runtime validation, TypeScript interfaces for compile-time safety
5. **Testing**: Comprehensive unit and integration tests with mocks for external dependencies

### Important Implementation Notes

- When modifying streaming logic, ensure proper cleanup of event listeners
- MCP permission requests must be handled synchronously to avoid blocking Claude
- Process spawn arguments are built dynamically based on conversation options
- Frontend uses React Router v6 for navigation
- All backend imports use path aliases (e.g., `@/services/...`)

### Permission Flow

1. **Permission Request**: When Claude needs tool approval, the MCP server sends a notification to `/api/permissions/notify`
2. **Frontend Display**: Permission requests are streamed to the frontend and displayed with approve/deny buttons
3. **User Decision**: Users click approve/deny, which calls `/api/permissions/:requestId/decision`
4. **MCP Polling**: The MCP server polls for decisions every second with a 10-minute timeout
5. **Response**: Once a decision is made, the MCP server returns the appropriate response to Claude

### Common Debugging

- Enable debug logs: `LOG_LEVEL=debug npm run dev`
- Test logs are silenced by default, use `npm run test:debug` for verbose output
- Check `~/.ccui/config.json` for server configuration
- MCP configuration is in `config/mcp-config.json`

## Session Information

The SessionInfoService manages extended metadata for conversation sessions. This information is now included as a complete `sessionInfo` object in ConversationSummary responses:

- **custom_name**: User-provided name for the session (default: "")
- **pinned**: Boolean flag for pinning important sessions (default: false)
- **archived**: Boolean flag for archiving old sessions (default: false) 
- **continuation_session_id**: Links to a continuation session if the conversation continues elsewhere (default: "")
- **initial_commit_head**: Git commit HEAD when the session started for tracking code changes (default: "")
- **created_at**: ISO 8601 timestamp when session info was created
- **updated_at**: ISO 8601 timestamp when session info was last updated
- **version**: Schema version for future migrations

Sessions are automatically migrated to include these fields when the schema version updates. All ConversationSummary objects now include the complete sessionInfo instead of just the custom_name field.

## Workflow Guidelines

- Always update tests if make any changes to api endpoint.

## Development Gotchas

- Do not run npm run dev to verify frontend update
- Before running test for the first time, run `npm run build` to build the backend and frontend, especially it build the mcp executable. Other wise the test will fail with Error: MCP tool mcp__ccui-permissions__approval_prompt (passed via --permission-prompt-tool) not found.