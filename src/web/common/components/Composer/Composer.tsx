import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ChevronDown, Mic, Send, Loader2, Sparkles, Laptop, Square, Check, X } from 'lucide-react';
import { DropdownSelector, DropdownOption } from '../DropdownSelector';
import { PermissionDialog } from '../PermissionDialog';
import type { PermissionRequest } from '@/types';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import styles from './Composer.module.css';

export interface FileSystemEntry {
  name: string;
  type: 'file' | 'directory';
  depth: number;
}

interface AutocompleteState {
  isActive: boolean;
  triggerIndex: number;
  query: string;
  suggestions: FileSystemEntry[];
  focusedIndex: number;
}

export interface ComposerProps {
  // Core functionality
  value?: string;
  onChange?: (value: string) => void;
  onSubmit: (message: string, workingDirectory?: string, model?: string, permissionMode?: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  disabled?: boolean;

  // Feature flags
  showDirectorySelector?: boolean;
  showModelSelector?: boolean;
  enableFileAutocomplete?: boolean;
  showPermissionUI?: boolean;
  showStopButton?: boolean;

  // Directory selection
  workingDirectory?: string;
  onDirectoryChange?: (directory: string) => void;
  recentDirectories?: Record<string, { lastDate: string; shortname: string }>;
  getMostRecentWorkingDirectory?: () => string | null;

  // Model selection
  model?: string;
  onModelChange?: (model: string) => void;
  availableModels?: string[];

  // Permission handling
  permissionRequest?: PermissionRequest | null;
  onPermissionDecision?: (requestId: string, action: 'approve' | 'deny') => void;

  // Stop functionality
  onStop?: () => void;

  // File autocomplete
  fileSystemEntries?: FileSystemEntry[];
  onFetchFileSystem?: (directory: string) => Promise<FileSystemEntry[]>;
  dropdownPosition?: 'above' | 'below';
}

export interface ComposerRef {
  focusInput: () => void;
}

interface DirectoryDropdownProps {
  selectedDirectory: string;
  recentDirectories: Record<string, { lastDate: string; shortname: string }>;
  onDirectorySelect: (directory: string) => void;
}

function DirectoryDropdown({ 
  selectedDirectory, 
  recentDirectories, 
  onDirectorySelect 
}: DirectoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Convert recentDirectories to sorted array and create options
  const options: DropdownOption<string>[] = Object.entries(recentDirectories)
    .map(([path, data]) => ({
      value: path,
      label: data.shortname,
    }))
    .sort((a, b) => {
      const dateA = recentDirectories[a.value].lastDate;
      const dateB = recentDirectories[b.value].lastDate;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

  // Get shortname for display
  const displayText = selectedDirectory === 'Select directory' 
    ? selectedDirectory
    : recentDirectories[selectedDirectory]?.shortname || selectedDirectory.split('/').pop() || selectedDirectory;

  return (
    <DropdownSelector
      options={options}
      value={selectedDirectory}
      onChange={(value) => {
        onDirectorySelect(value);
        setIsOpen(false);
      }}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      placeholder="Enter a directory..."
      showFilterInput={true}
      filterPredicate={(option, searchText) => {
        // Allow filtering by path
        if (option.value.toLowerCase().includes(searchText.toLowerCase())) {
          return true;
        }
        // If the search text looks like a path and doesn't match any existing option,
        // the user can press Enter to add it as a new directory
        return false;
      }}
      renderTrigger={({ onClick }) => (
        <button
          type="button"
          className={styles.actionButton}
          onClick={onClick}
          aria-label="View all code environments"
        >
          <Laptop size={14} />
          <span className={styles.buttonText}>
            <span className={styles.buttonLabel}>{displayText}</span>
          </span>
          <ChevronDown size={14} />
        </button>
      )}
    />
  );
}

interface AutocompleteDropdownProps {
  suggestions: FileSystemEntry[];
  onSelect: (path: string) => void;
  onClose: () => void;
  isOpen: boolean;
  focusedIndex: number;
  position?: 'above' | 'below';
  triggerRef?: React.RefObject<HTMLElement>;
}

function AutocompleteDropdown({
  suggestions,
  onSelect,
  onClose,
  isOpen,
  focusedIndex,
  position = 'below',
  triggerRef,
}: AutocompleteDropdownProps) {
  if (!isOpen) return null;

  return (
    <div className={`${styles.autocompleteDropdown} ${position === 'above' ? styles.autocompleteDropdownAbove : ''}`}>
      <DropdownSelector
        options={suggestions.map((entry) => ({
          value: entry.name,
          label: entry.name,
          disabled: false
        }))}
        value={undefined}
        onChange={onSelect}
        isOpen={true}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        showFilterInput={false}
        maxVisibleItems={5}
        className={styles.pathAutocomplete}
        initialFocusedIndex={focusedIndex}
        visualFocusOnly={true}
        triggerElementRef={triggerRef}
      />
    </div>
  );
}

interface ComposerCache {
  selectedPermissionMode: string;
  draft: string;
}

export const Composer = forwardRef<ComposerRef, ComposerProps>(function Composer({
  value: controlledValue,
  onChange: onControlledChange,
  onSubmit,
  placeholder = "Type a message...",
  isLoading = false,
  disabled = false,
  showDirectorySelector = false,
  showModelSelector = false,
  enableFileAutocomplete = false,
  showPermissionUI = false,
  showStopButton = false,
  workingDirectory = '',
  onDirectoryChange,
  recentDirectories = {},
  getMostRecentWorkingDirectory,
  model = 'default',
  onModelChange,
  availableModels = ['default', 'opus', 'sonnet'],
  permissionRequest,
  onPermissionDecision,
  onStop,
  fileSystemEntries = [],
  onFetchFileSystem,
  dropdownPosition = 'below',
}: ComposerProps, ref: React.Ref<ComposerRef>) {
  // Load cached state
  const [cachedState, setCachedState] = useLocalStorage<ComposerCache>('ccui-composer', {
    selectedPermissionMode: 'default',
    draft: '',
  });

  // Use controlled or uncontrolled value
  const [uncontrolledValue, setUncontrolledValue] = useState(cachedState.draft);
  const value = controlledValue !== undefined ? controlledValue : uncontrolledValue;
  const setValue = (newValue: string) => {
    if (controlledValue === undefined) {
      setUncontrolledValue(newValue);
    }
    onControlledChange?.(newValue);
  };

  const [selectedDirectory, setSelectedDirectory] = useState(workingDirectory || 'Select directory');
  const [selectedModel, setSelectedModel] = useState(model);
  const [selectedPermissionMode, setSelectedPermissionMode] = useState<string>(cachedState.selectedPermissionMode);
  const [isPermissionDropdownOpen, setIsPermissionDropdownOpen] = useState(false);
  const [localFileSystemEntries, setLocalFileSystemEntries] = useState<FileSystemEntry[]>(fileSystemEntries);
  const [autocomplete, setAutocomplete] = useState<AutocompleteState>({
    isActive: false,
    triggerIndex: -1,
    query: '',
    suggestions: [],
    focusedIndex: 0,
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Expose focusInput method via ref
  useImperativeHandle(ref, () => ({
    focusInput: () => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }), []);

  // Update local state when props change
  useEffect(() => {
    if (workingDirectory) {
      setSelectedDirectory(workingDirectory);
    }
  }, [workingDirectory]);

  useEffect(() => {
    if (model) {
      setSelectedModel(model);
    }
  }, [model]);

  useEffect(() => {
    if (fileSystemEntries.length > 0) {
      setLocalFileSystemEntries(fileSystemEntries);
    }
  }, [fileSystemEntries]);

  // Update cache when state changes
  useEffect(() => {
    setCachedState({
      selectedPermissionMode,
      draft: value,
    });
  }, [selectedPermissionMode, value, setCachedState]);

  // Auto-select most recent directory on mount (for Home usage)
  useEffect(() => {
    if (showDirectorySelector && (!workingDirectory || selectedDirectory === 'Select directory') && Object.keys(recentDirectories).length > 0 && getMostRecentWorkingDirectory) {
      const mostRecent = getMostRecentWorkingDirectory();
      if (mostRecent) {
        setSelectedDirectory(mostRecent);
        onDirectoryChange?.(mostRecent);
        
        // Fetch file system entries for the auto-selected directory
        if (enableFileAutocomplete && onFetchFileSystem) {
          onFetchFileSystem(mostRecent)
            .then(entries => setLocalFileSystemEntries(entries))
            .catch(error => console.error('Failed to fetch file system entries:', error));
        }
      }
    }
  }, [workingDirectory, selectedDirectory, recentDirectories, getMostRecentWorkingDirectory, showDirectorySelector, onDirectoryChange, enableFileAutocomplete, onFetchFileSystem]);

  // Fetch file system entries when composer is focused (for autocomplete)
  useEffect(() => {
    if (!enableFileAutocomplete || !onFetchFileSystem) return;

    const fetchFileSystem = async () => {
      if (selectedDirectory && selectedDirectory !== 'Select directory') {
        try {
          const entries = await onFetchFileSystem(selectedDirectory);
          setLocalFileSystemEntries(entries);
        } catch (error) {
          console.error('Failed to fetch file system entries:', error);
        }
      }
    };

    const textarea = textareaRef.current;
    if (textarea) {
      const handleFocus = () => fetchFileSystem();
      textarea.addEventListener('focus', handleFocus);
      return () => textarea.removeEventListener('focus', handleFocus);
    }
  }, [selectedDirectory, enableFileAutocomplete, onFetchFileSystem]);

  const detectAutocomplete = (value: string, cursorPosition: number) => {
    // Find the last @ before cursor
    const beforeCursor = value.substring(0, cursorPosition);
    const lastAtIndex = beforeCursor.lastIndexOf('@');
    
    if (lastAtIndex === -1) return null;
    
    // Check if there's a space or newline between @ and cursor
    const afterAt = beforeCursor.substring(lastAtIndex + 1);
    if (afterAt.includes(' ') || afterAt.includes('\n')) return null;
    
    return {
      triggerIndex: lastAtIndex,
      query: afterAt,
    };
  };

  const filterSuggestions = (query: string): FileSystemEntry[] => {
    if (!query) return localFileSystemEntries.slice(0, 50); // Show first 50 entries when no query
    
    const lowerQuery = query.toLowerCase();
    return localFileSystemEntries
      .filter(entry => entry.name.toLowerCase().includes(lowerQuery))
      .slice(0, 50); // Limit to 50 results
  };

  const resetAutocomplete = () => {
    setAutocomplete({
      isActive: false,
      triggerIndex: -1,
      query: '',
      suggestions: [],
      focusedIndex: 0,
    });
  };

  const getPermissionModeLabel = (mode: string): string => {
    switch (mode) {
      case 'default': return 'Code';
      case 'acceptEdits': return 'Auto';
      case 'bypassPermissions': return 'Yolo';
      case 'plan': return 'Plan';
      default: return 'Code';
    }
  };

  const getPermissionModeTitle = (mode: string): string => {
    switch (mode) {
      case 'default': return 'Code - Ask for permissions as needed';
      case 'acceptEdits': return 'Auto - Allow Claude to make changes directly';
      case 'bypassPermissions': return 'Yolo - Skip all permission prompts';
      case 'plan': return 'Plan - Create a plan without executing';
      default: return 'Code - Ask for permissions as needed';
    }
  };

  const handlePathSelection = (path: string) => {
    if (!textareaRef.current) return;
    
    const cursorPos = textareaRef.current.selectionStart;
    const newText = value.substring(0, autocomplete.triggerIndex + 1) + path + value.substring(cursorPos);
    setValue(newText);
    
    // Reset autocomplete state immediately
    resetAutocomplete();
    
    // Set cursor position after the inserted path and adjust height
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = autocomplete.triggerIndex + 1 + path.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
        adjustTextareaHeight();
      }
    }, 0);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    adjustTextareaHeight();
    
    if (!enableFileAutocomplete) return;

    // Detect autocomplete trigger
    const cursorPos = e.target.selectionStart;
    const autocompleteInfo = detectAutocomplete(newValue, cursorPos);
    
    if (autocompleteInfo) {
      const suggestions = filterSuggestions(autocompleteInfo.query);
      setAutocomplete(prev => ({
        isActive: true,
        triggerIndex: autocompleteInfo.triggerIndex,
        query: autocompleteInfo.query,
        suggestions,
        // Keep focusedIndex if it's still valid, otherwise reset to 0
        focusedIndex: prev.focusedIndex < suggestions.length ? prev.focusedIndex : 0,
      }));
    } else {
      resetAutocomplete();
    }
  };

  const handleSubmit = (permissionMode: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue || isLoading) return;

    // For Home usage with directory/model
    if (showDirectorySelector && selectedDirectory === 'Select directory') return;

    onSubmit(
      trimmedValue,
      showDirectorySelector ? selectedDirectory : undefined,
      showModelSelector ? selectedModel : undefined,
      permissionMode
    );
    
    setValue('');
    resetAutocomplete();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (enableFileAutocomplete && autocomplete.isActive) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (autocomplete.suggestions.length > 0) {
            setAutocomplete(prev => ({
              ...prev,
              focusedIndex: (prev.focusedIndex + 1) % prev.suggestions.length
            }));
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (autocomplete.suggestions.length > 0) {
            setAutocomplete(prev => ({
              ...prev,
              focusedIndex: prev.focusedIndex === 0 ? prev.suggestions.length - 1 : prev.focusedIndex - 1
            }));
          }
          break;
        case 'Enter':
        case 'Tab':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            if (autocomplete.suggestions.length > 0) {
              // Select the currently focused suggestion
              handlePathSelection(autocomplete.suggestions[autocomplete.focusedIndex].name);
            }
          }
          break;
        case ' ':
          // Don't prevent default for space - let it insert the character
          resetAutocomplete();
          break;
        case 'Escape':
          e.preventDefault();
          resetAutocomplete();
          break;
      }
    } else if (e.key === 'Enter') {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        handleSubmit(selectedPermissionMode);
      }
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const maxHeight = Math.floor(window.innerHeight * 0.8); // Up to 80% of viewport
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
  };

  // Adjust height whenever text changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [value]);

  // Re-adjust height on window resize
  useEffect(() => {
    const handleResize = () => {
      adjustTextareaHeight();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleDirectorySelect = (directory: string) => {
    setSelectedDirectory(directory);
    onDirectoryChange?.(directory);
  };

  const handleModelSelect = (model: string) => {
    setSelectedModel(model);
    onModelChange?.(model);
  };

  return (
    <form className={styles.composer} onSubmit={(e) => {
      e.preventDefault();
      handleSubmit(selectedPermissionMode);
    }}>
      {enableFileAutocomplete && dropdownPosition === 'above' && (
        <AutocompleteDropdown
          suggestions={autocomplete.suggestions}
          onSelect={handlePathSelection}
          onClose={resetAutocomplete}
          isOpen={autocomplete.isActive && autocomplete.suggestions.length > 0}
          focusedIndex={autocomplete.focusedIndex}
          position={dropdownPosition}
        />
      )}
      <div className={styles.container}>
        <div className={styles.inputWrapper}>
          <div className={styles.textAreaContainer}>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              placeholder={placeholder}
              value={value}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isLoading || disabled}
            />
          </div>

          {(showDirectorySelector || showModelSelector) && (
            <div className={styles.footerActions}>
              <div className={styles.actionButtons}>
                <div className={styles.actionGroup}>
                  {/* Working Directory Selector */}
                  {showDirectorySelector && (
                    <DirectoryDropdown
                      selectedDirectory={selectedDirectory}
                      recentDirectories={recentDirectories}
                      onDirectorySelect={handleDirectorySelect}
                    />
                  )}

                  {/* Model Selector */}
                  {showModelSelector && (
                    <button
                      type="button"
                      className={styles.actionButton}
                      aria-label="Select AI model"
                      onClick={() => {
                        // Toggle between models for now
                        const currentIndex = availableModels.indexOf(selectedModel);
                        const nextIndex = (currentIndex + 1) % availableModels.length;
                        handleModelSelect(availableModels[nextIndex]);
                      }}
                    >
                      <Sparkles size={14} />
                      <span className={styles.buttonText}>
                        <span className={styles.buttonLabel}>{selectedModel}</span>
                      </span>
                      <ChevronDown size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Dynamic Action Button */}
          <div className={styles.voiceButton}>
            {permissionRequest && showPermissionUI ? (
              <div className={styles.permissionButtons}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary} ${styles.approveButton}`}
                  onClick={() => onPermissionDecision?.(permissionRequest.id, 'approve')}
                >
                  <div className={styles.btnContent}>
                    <Check size={14} />
                    Accept
                  </div>
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary} ${styles.denyButton}`}
                  onClick={() => onPermissionDecision?.(permissionRequest.id, 'deny')}
                >
                  <div className={styles.btnContent}>
                    <X size={14} />
                    Deny
                  </div>
                </button>
              </div>
            ) : isLoading && showStopButton ? (
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => onStop?.()}
                title="Stop generation"
              >
                <Square size={18} />
              </button>
            ) : value.trim() ? (
              <div className={styles.permissionModeButtons}>
                {/* Combined Permission Mode Button with Dropdown */}
                <div className={styles.combinedPermissionButton}>
                  <button
                    type="button"
                    className={styles.permissionMainButton}
                    title={getPermissionModeTitle(selectedPermissionMode)}
                    disabled={isLoading || disabled || (showDirectorySelector && selectedDirectory === 'Select directory')}
                    onClick={() => handleSubmit(selectedPermissionMode)}
                  >
                    <div className={styles.btnContent}>
                      {isLoading ? <Loader2 size={14} className={styles.spinning} /> : getPermissionModeLabel(selectedPermissionMode)}
                    </div>
                  </button>
                  <DropdownSelector
                    options={[
                      { value: 'default', label: 'Code' },
                      { value: 'acceptEdits', label: 'Auto' },
                      { value: 'bypassPermissions', label: 'Yolo' },
                      { value: 'plan', label: 'Plan' },
                    ]}
                    value={selectedPermissionMode}
                    onChange={setSelectedPermissionMode}
                    isOpen={isPermissionDropdownOpen}
                    onOpenChange={setIsPermissionDropdownOpen}
                    showFilterInput={false}
                    renderTrigger={({ onClick }) => (
                      <button
                        type="button"
                        className={styles.permissionDropdownButton}
                        onClick={onClick}
                        disabled={isLoading || disabled || (showDirectorySelector && selectedDirectory === 'Select directory')}
                        aria-label="Select permission mode"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M4.5 5.5L8 9L11.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                        </svg>
                      </button>
                    )}
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={styles.iconButton}
                aria-label="Dictate button"
                disabled={isLoading || disabled}
                title="Voice input"
              >
                <Mic size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
      {enableFileAutocomplete && dropdownPosition === 'below' && (
        <AutocompleteDropdown
          suggestions={autocomplete.suggestions}
          onSelect={handlePathSelection}
          onClose={resetAutocomplete}
          isOpen={autocomplete.isActive && autocomplete.suggestions.length > 0}
          focusedIndex={autocomplete.focusedIndex}
          position={dropdownPosition}
          triggerRef={textareaRef}
        />
      )}
      
      {/* Permission Dialog */}
      {permissionRequest && showPermissionUI && (
        <PermissionDialog 
          permissionRequest={permissionRequest}
          isVisible={true}
        />
      )}
    </form>
  );
});