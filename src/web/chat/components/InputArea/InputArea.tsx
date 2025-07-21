import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, Zap, ChevronDown, Mic } from 'lucide-react';
import styles from './InputArea.module.css';

interface InputAreaProps {
  onSubmit: (message: string) => void;
  onStop?: () => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function InputArea({ onSubmit, onStop, isLoading = false, placeholder = "Type a message..." }: InputAreaProps) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [message]);

  useEffect(() => {
    // Handle click outside to blur
    const handleClickOutside = (event: MouseEvent) => {
      if (composerRef.current && !composerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
          <div 
            ref={composerRef}
            className={`${styles.composerInner} ${isFocused || message.trim() ? styles.expanded : ''}`}
            onClick={() => textareaRef.current?.focus()}
          >
            <div className={styles.inputWrapper}>
              <div className={styles.textAreaContainer}>
                <textarea
                  ref={textareaRef}
                  className={styles.textarea}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setIsFocused(true)}
                  placeholder={placeholder}
                  disabled={isLoading}
                  rows={1}
                />
              </div>
              
              {(isFocused || message.trim() || isLoading) && (
                <div className={styles.footerActions}>
                  <div className={styles.actionButtons}>
                    <button 
                      type="button" 
                      className={styles.actionButton}
                      title="Model version selector"
                    >
                      <Zap size={14} />
                      <span className={styles.buttonText}>1x</span>
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
              )}
              
              <div className={styles.voiceButton}>
                {isLoading ? (
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => onStop?.()}
                    title="Stop generation"
                  >
                    <Square size={18} />
                  </button>
                ) : message.trim() ? (
                  <button
                    type="submit"
                    className={styles.iconButton}
                    title="Send message (Enter)"
                  >
                    <Send size={18} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.iconButton}
                    title="Voice input"
                    disabled
                  >
                    <Mic size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}