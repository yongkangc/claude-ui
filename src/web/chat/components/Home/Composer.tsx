import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Mic, Send, Loader2, Sparkles, Laptop, Plus } from 'lucide-react';
import { DropdownSelector, DropdownOption } from '@/web/common/components/DropdownSelector';
import { useConversations } from '../../contexts/ConversationsContext';
import { api } from '../../services/api';
import type { FileSystemEntry } from '../../types';
import styles from './Composer.module.css';

interface ComposerProps {
  workingDirectory?: string;
  onSubmit?: (text: string, workingDirectory: string, branch: string, model: string) => void;
  isSubmitting?: boolean;
}

interface AutocompleteState {
  isActive: boolean;
  triggerIndex: number;
  query: string;
  suggestions: FileSystemEntry[];
  focusedIndex: number;
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
}

function AutocompleteDropdown({
  suggestions,
  onSelect,
  onClose,
  isOpen,
  focusedIndex,
}: AutocompleteDropdownProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.autocompleteDropdown}>
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
      />
    </div>
  );
}

export function Composer({ workingDirectory = '', onSubmit, isSubmitting = false }: ComposerProps) {
  const [text, setText] = useState('');
  const [selectedDirectory, setSelectedDirectory] = useState(workingDirectory || 'Select directory');
  const [selectedModel, setSelectedModel] = useState('default');
  const [fileSystemEntries, setFileSystemEntries] = useState<FileSystemEntry[]>([]);
  const [autocomplete, setAutocomplete] = useState<AutocompleteState>({
    isActive: false,
    triggerIndex: -1,
    query: '',
    suggestions: [],
    focusedIndex: 0,
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { recentDirectories, getMostRecentWorkingDirectory } = useConversations();

  // Auto-select most recent directory on mount
  useEffect(() => {
    if ((!workingDirectory || selectedDirectory === 'Select directory') && Object.keys(recentDirectories).length > 0) {
      const mostRecent = getMostRecentWorkingDirectory();
      if (mostRecent) {
        setSelectedDirectory(mostRecent);
      }
    }
  }, [workingDirectory, selectedDirectory, recentDirectories, getMostRecentWorkingDirectory]);

  // Fetch file system entries when composer is focused
  useEffect(() => {
    const fetchFileSystem = async () => {
      if (selectedDirectory && selectedDirectory !== 'Select directory') {
        try {
          const response = await api.listDirectory({
            path: selectedDirectory,
            recursive: true,
            respectGitignore: true,
          });
          setFileSystemEntries(response.entries);
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
  }, [selectedDirectory]);

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
    if (!query) return fileSystemEntries.slice(0, 50); // Show first 50 entries when no query
    
    const lowerQuery = query.toLowerCase();
    return fileSystemEntries
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

  const handlePathSelection = (path: string) => {
    if (!textareaRef.current) return;
    
    const cursorPos = textareaRef.current.selectionStart;
    const newText = text.substring(0, autocomplete.triggerIndex + 1) + path + text.substring(cursorPos);
    setText(newText);
    
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
    setText(newValue);
    adjustTextareaHeight();
    
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && onSubmit && selectedDirectory !== 'Select directory') {
      onSubmit(text.trim(), selectedDirectory, 'main', selectedModel);
      setText('');
      resetAutocomplete();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (autocomplete.isActive) {
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
        handleSubmit(e as any);
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
  }, [text]);

  // Re-adjust height on window resize
  useEffect(() => {
    const handleResize = () => {
      adjustTextareaHeight();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <form className={styles.composer} onSubmit={handleSubmit}>
      <div className={styles.container}>
        <div className={styles.inputWrapper}>
          <div className={styles.textAreaContainer}>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              placeholder="Describe another task"
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isSubmitting}
            />
          </div>

          <div className={styles.footerActions}>
            <div className={styles.actionButtons}>
              <div className={styles.actionGroup}>
                {/* Working Directory Selector */}
                <DirectoryDropdown
                  selectedDirectory={selectedDirectory}
                  recentDirectories={recentDirectories}
                  onDirectorySelect={setSelectedDirectory}
                />

                {/* Model Selector */}
                <button
                  type="button"
                  className={styles.actionButton}
                  aria-label="Select AI model"
                  onClick={() => {
                    // Toggle between models for now
                    const models = ['default', 'opus', 'sonnet'];
                    const currentIndex = models.indexOf(selectedModel);
                    const nextIndex = (currentIndex + 1) % models.length;
                    setSelectedModel(models[nextIndex]);
                  }}
                >
                  <Sparkles size={14} />
                  <span className={styles.buttonText}>
                    <span className={styles.buttonLabel}>{selectedModel}</span>
                  </span>
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Dynamic Action Button */}
          <div className={styles.voiceButton}>
            <button
              type={text.trim() ? "submit" : "button"}
              className={styles.iconButton}
              aria-label={text.trim() ? "Send message" : "Dictate button"}
              disabled={isSubmitting || (!!text.trim() && selectedDirectory === 'Select directory')}
            >
              {isSubmitting ? (
                <Loader2 size={18} className={styles.spinning} />
              ) : text.trim() ? (
                <Send size={18} />
              ) : (
                <Mic size={18} />
              )}
            </button>
          </div>
        </div>
      </div>
      <AutocompleteDropdown
        suggestions={autocomplete.suggestions}
        onSelect={handlePathSelection}
        onClose={resetAutocomplete}
        isOpen={autocomplete.isActive && autocomplete.suggestions.length > 0}
        focusedIndex={autocomplete.focusedIndex}
      />
    </form>
  );
}