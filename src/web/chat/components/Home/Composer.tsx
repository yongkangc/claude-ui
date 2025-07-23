import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Mic, Send, Loader2, Sparkles, Laptop, Plus } from 'lucide-react';
import { DropdownSelector, DropdownOption } from '@/web/common/components/DropdownSelector';
import { useConversations } from '../../contexts/ConversationsContext';
import styles from './Composer.module.css';

interface ComposerProps {
  workingDirectory?: string;
  onSubmit?: (text: string, workingDirectory: string, branch: string, model: string) => void;
  isSubmitting?: boolean;
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

export function Composer({ workingDirectory = '', onSubmit, isSubmitting = false }: ComposerProps) {
  const [text, setText] = useState('');
  const [selectedDirectory, setSelectedDirectory] = useState(workingDirectory || 'Select directory');
  const [selectedModel, setSelectedModel] = useState('default');
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && onSubmit && selectedDirectory !== 'Select directory') {
      onSubmit(text.trim(), selectedDirectory, 'main', selectedModel);
      setText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
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
      textarea.style.height = `${Math.min(textarea.scrollHeight, 208)}px`;
    }
  };

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
              onChange={(e) => {
                setText(e.target.value);
                adjustTextareaHeight();
              }}
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
    </form>
  );
}