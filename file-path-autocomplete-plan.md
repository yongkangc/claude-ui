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
  focusedIndex: number;     // -1 = textarea focused, 0+ = suggestion index focused
}
```

### 2. Keyboard Event Handling

Modify the existing `handleKeyDown` function in Composer.tsx to handle autocomplete navigation:

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

```typescript
// Fetch suggestions when query changes
useEffect(() => {
  if (!autocomplete.isActive) return;
  
  const fetchSuggestions = debounce(async () => {
    try {
      // Parse the query to determine base path
      // Example: query "src/components/But" becomes:
      // - basePath: {workingDirectory}/src/components
      // - searchTerm: "But"
      const queryParts = autocomplete.query.split('/');
      const searchTerm = queryParts.pop() || '';
      const basePath = queryParts.length > 0 
        ? path.join(selectedDirectory, queryParts.join('/'))
        : selectedDirectory;
      
      const response = await api.listDirectory({
        path: basePath,
        recursive: true,
        respectGitignore: true
      });
      
      // Filter entries based on search term
      const filtered = response.entries
        .filter(entry => entry.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .slice(0, 20); // Limit results for performance
      
      setAutocomplete(prev => ({
        ...prev,
        suggestions: filtered,
        focusedIndex: -1 // Reset focus to textarea when suggestions update
      }));
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      // On error, keep previous suggestions or show empty list
    }
  }, 300); // 300ms debounce to avoid too many API calls
  
  fetchSuggestions();
}, [autocomplete.query, autocomplete.isActive, selectedDirectory]);
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
      // Note: May need to modify DropdownSelector to accept focusedIndex
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
- `focusedIndex = -1`: Focus is in the textarea
- `focusedIndex >= 0`: Focus is on a specific suggestion in the dropdown
- Arrow keys move focus between textarea and suggestions
- Enter key behavior depends on current focus location

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
  - Base directory for API calls (e.g., `@src/components/` → search in `{workingDir}/src/components/`)
  - Search term for filtering (e.g., `@src/components/But` → search for files containing "But")
- Supports both relative paths from working directory and absolute paths

### Performance Considerations
- **Debouncing**: API calls are debounced by 300ms to avoid excessive requests
- **Result Limiting**: Only show top 20 results to keep dropdown manageable
- **Caching**: Consider implementing client-side caching for recently accessed directories
- **Error Handling**: Failed API calls don't break the user experience

## Testing Strategy

### Unit Tests
1. Test `detectAutocomplete()` function with various input scenarios
2. Test keyboard navigation state transitions
3. Test path selection and text replacement logic
4. Test API integration with mock responses

### Integration Tests
1. Test complete autocomplete flow from typing "@" to selection
2. Test space key closes dropdown
3. Test error handling when API fails
4. Test performance with large file lists

### Edge Cases to Test
1. Multiple "@" symbols in text
2. Cursor movement away from "@" area
3. Empty directories
4. Permission errors accessing directories
5. Very long file paths
6. Special characters in file names

## Future Enhancements

### Exact Positioning (Phase 2)
- Implement textarea mirror div for exact character positioning
- Position dropdown at the "@" character location instead of below textarea
- Add logic to show above/below based on viewport space

### Advanced Features
- File type icons in suggestions
- Recent files prioritization
- Fuzzy matching for file names
- Directory-only vs file-only filtering options