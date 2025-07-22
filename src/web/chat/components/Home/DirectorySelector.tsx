import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Laptop } from 'lucide-react';
import styles from './DirectorySelector.module.css';

interface RecentDirectory {
  path: string;
  shortname: string;
  lastDate: string;
}

interface DirectorySelectorProps {
  selectedDirectory: string;
  recentDirectories: Record<string, { lastDate: string; shortname: string }>;
  onDirectorySelect: (directory: string) => void;
}

export function DirectorySelector({ 
  selectedDirectory, 
  recentDirectories, 
  onDirectorySelect 
}: DirectorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const directoryRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Convert recentDirectories to sorted array
  const sortedDirectories: RecentDirectory[] = Object.entries(recentDirectories)
    .map(([path, data]) => ({
      path,
      shortname: data.shortname,
      lastDate: data.lastDate
    }))
    .sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());

  // Filter directories based on input value
  const filteredDirectories = inputValue.trim() 
    ? sortedDirectories.filter(dir => 
        dir.path.toLowerCase().includes(inputValue.toLowerCase())
      )
    : sortedDirectories;

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle focus management
  useEffect(() => {
    if (focusedIndex >= 0 && focusedIndex < directoryRefs.current.length) {
      directoryRefs.current[focusedIndex]?.focus();
    } else if (focusedIndex === -1 && inputRef.current) {
      inputRef.current.focus();
    }
  }, [focusedIndex]);

  // Reset focused index when dropdown closes or filter changes
  useEffect(() => {
    if (!isOpen) {
      setFocusedIndex(-1);
    }
  }, [isOpen]);

  useEffect(() => {
    setFocusedIndex(-1);
  }, [inputValue]);

  const handleAddPath = () => {
    if (inputValue.trim()) {
      onDirectorySelect(inputValue.trim());
      setInputValue('');
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddPath();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredDirectories.length > 0) {
        setFocusedIndex(0);
      }
    }
  };

  const handleDirectoryListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (focusedIndex > 0) {
        setFocusedIndex(focusedIndex - 1);
      } else if (focusedIndex === 0) {
        setFocusedIndex(-1);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (focusedIndex < filteredDirectories.length - 1) {
        setFocusedIndex(focusedIndex + 1);
      }
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      const dir = filteredDirectories[focusedIndex];
      if (dir) {
        onDirectorySelect(dir.path);
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  // Get shortname for display
  const displayText = selectedDirectory === 'Select directory' 
    ? selectedDirectory
    : recentDirectories[selectedDirectory]?.shortname || selectedDirectory.split('/').pop() || selectedDirectory;

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button
        type="button"
        className={styles.actionButton}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="View all code environments"
      >
        <Laptop size={14} />
        <span className={styles.buttonText}>
          <span className={styles.buttonLabel}>{displayText}</span>
        </span>
        <ChevronDown size={14} />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          {/* Input section */}
          <div className={styles.inputSection}>
            <div className={styles.inputWrapper}>
              <input
                ref={inputRef}
                type="text"
                className={styles.input}
                placeholder="Enter directory path..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              <button
                type="button"
                className={styles.addButton}
                onClick={handleAddPath}
                disabled={!inputValue.trim()}
                aria-label="Add directory"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Separator */}
          <div className={styles.separator} />

          {/* Directory list */}
          <div className={styles.directoryList} onKeyDown={handleDirectoryListKeyDown}>
            {filteredDirectories.map((dir, index) => (
              <button
                key={dir.path}
                ref={(el) => { directoryRefs.current[index] = el; }}
                type="button"
                className={`${styles.directoryItem} ${
                  selectedDirectory === dir.path ? styles.selected : ''
                } ${focusedIndex === index ? styles.focused : ''}`}
                onClick={() => {
                  onDirectorySelect(dir.path);
                  setIsOpen(false);
                }}
                tabIndex={-1}
              >
                <div className={styles.directoryContent}>
                  <div className={styles.directoryInfo}>
                    <div className={styles.directoryName}>
                      <span className={styles.directoryText}>{dir.shortname}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.checkmark} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}