import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, Zap, ChevronDown, Mic, Check, X } from 'lucide-react';
import type { PermissionRequest } from '@/types';
import styles from './InputArea.module.css';

interface InputAreaProps {
  onSubmit: (message: string) => void;
  onStop?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  permissionRequest?: PermissionRequest | null;
}

export function InputArea({ onSubmit, onStop, isLoading = false, placeholder = "Type a message...", permissionRequest }: InputAreaProps) {
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
        // Reset textarea height when clicking outside
        if (textareaRef.current && !message.trim()) {
          textareaRef.current.style.height = 'auto';
        }
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
            className={`${styles.composerInner} ${isFocused ? styles.expanded : ''} ${permissionRequest ? styles.permissionMode : ''}`}
            onClick={() => !permissionRequest && textareaRef.current?.focus()}
          >
            <div className={styles.inputWrapper}>
              <div className={styles.textAreaContainer}>
                {permissionRequest ? (
                  <div className={styles.permissionContent}>
                    <div className={styles.permissionHeader}>
                      <span className={styles.permissionTitle}>Permission Required</span>
                      <span className={styles.permissionTool}>{permissionRequest.toolName}</span>
                    </div>
                    <details className={styles.permissionDetails}>
                      <summary>View Details</summary>
                      <pre className={styles.permissionInput}>
                        {JSON.stringify(permissionRequest.toolInput, null, 2)}
                      </pre>
                    </details>
                  </div>
                ) : (
                  <textarea
                    ref={textareaRef}
                    className={styles.textarea}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => {
                      setIsFocused(false);
                      // Reset textarea height when losing focus
                      if (textareaRef.current && !message.trim()) {
                        textareaRef.current.style.height = 'auto';
                      }
                    }}
                    placeholder={placeholder}
                    disabled={isLoading}
                    rows={1}
                  />
                )}
              </div>
              
              {isFocused && (
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
                {permissionRequest ? (
                  <div className={styles.permissionButtons}>
                    <button
                      type="button"
                      className={`${styles.iconButton} ${styles.permissionButton} ${styles.approveButton}`}
                      title="Approve (non-functional)"
                      disabled
                    >
                      <Check size={18} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconButton} ${styles.permissionButton} ${styles.denyButton}`}
                      title="Deny (non-functional)"
                      disabled
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : isLoading ? (
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