import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Convert recentDirectories to sorted array
  const sortedDirectories: RecentDirectory[] = Object.entries(recentDirectories)
    .map(([path, data]) => ({
      path,
      shortname: data.shortname,
      lastDate: data.lastDate
    }))
    .sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());

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
    }
  };

  const displayText = selectedDirectory.length > 20 
    ? `...${selectedDirectory.slice(-20)}` 
    : selectedDirectory;

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button
        type="button"
        className={styles.actionButton}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="View all code environments"
      >
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
          <div className={styles.directoryList}>
            {sortedDirectories.map((dir) => (
              <button
                key={dir.path}
                type="button"
                className={`${styles.directoryItem} ${
                  selectedDirectory === dir.path ? styles.selected : ''
                }`}
                onClick={() => {
                  onDirectorySelect(dir.path);
                  setIsOpen(false);
                }}
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