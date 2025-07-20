import React, { useState, useRef } from 'react';
import { ChevronDown, Mic } from 'lucide-react';
import styles from './Composer.module.css';

interface ComposerProps {
  workingDirectory?: string;
  onSubmit?: (text: string, workingDirectory: string, branch: string, model: string) => void;
}

export function Composer({ workingDirectory = '', onSubmit }: ComposerProps) {
  const [text, setText] = useState('');
  const [selectedDirectory, setSelectedDirectory] = useState(workingDirectory || 'Select directory');
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [selectedModel, setSelectedModel] = useState('1x');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && onSubmit) {
      onSubmit(text.trim(), selectedDirectory, selectedBranch, selectedModel);
      setText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
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
            />
          </div>

          <div className={styles.footerActions}>
            <div className={styles.actionButtons}>
              <div className={styles.actionGroup}>
                {/* Working Directory Selector */}
                <button
                  type="button"
                  className={styles.actionButton}
                  aria-label="View all code environments"
                >
                  <span className={styles.buttonText}>
                    <span className={styles.buttonLabel}>
                      {selectedDirectory.length > 20 
                        ? `...${selectedDirectory.slice(-20)}` 
                        : selectedDirectory}
                    </span>
                  </span>
                  <ChevronDown size={14} />
                </button>

                {/* Branch Selector */}
                <button
                  type="button"
                  className={styles.actionButton}
                  aria-label="Search for your branch"
                >
                  <span className={styles.buttonText}>
                    <span className={styles.buttonLabel}>{selectedBranch}</span>
                  </span>
                  <ChevronDown size={14} />
                </button>
              </div>

              {/* Model Selector */}
              <button
                type="button"
                className={styles.actionButton}
                aria-label="Open versions number selector"
              >
                <span className={styles.buttonText}>
                  <span className={styles.buttonLabel}>{selectedModel}</span>
                </span>
                <ChevronDown size={14} />
              </button>
            </div>
          </div>

          {/* Voice Input Button */}
          <div className={styles.voiceButton}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Dictate button"
            >
              <Mic size={18} />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}