import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, Zap, ChevronDown } from 'lucide-react';
import styles from './InputArea.module.css';

interface InputAreaProps {
  onSubmit: (message: string) => void;
  onStop?: () => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function InputArea({ onSubmit, onStop, isLoading = false, placeholder = "Type a message..." }: InputAreaProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [message]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isLoading) return;

    onSubmit(trimmedMessage);
    setMessage('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.composerWrapper}>
        <form className={styles.composer} onSubmit={handleSubmit}>
          <div className={styles.composerInner}>
            <div className={styles.inputSection}>
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={isLoading}
                rows={1}
              />
            </div>
            
            <div className={styles.footerActions}>
              <button 
                type="button" 
                className={styles.versionButton}
                title="Model version selector"
              >
                <Zap size={16} />
                <span>1x</span>
                <ChevronDown size={16} />
              </button>
            </div>
            
            <div className={styles.submitActions}>
              {isLoading ? (
                <button
                  type="button"
                  className={styles.stopButton}
                  onClick={() => onStop?.()}
                  title="Stop generation"
                >
                  <Square size={16} />
                </button>
              ) : (
                <button
                  type="submit"
                  className={styles.sendButton}
                  disabled={!message.trim()}
                  title="Send message (Enter)"
                >
                  <Send size={16} />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}