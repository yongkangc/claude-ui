import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, Zap, ChevronDown, Mic, Check, X } from 'lucide-react';
import type { PermissionRequest } from '@/types';
import styles from './InputArea.module.css';

interface InputAreaProps {
  onSubmit: (message: string) => void;
  onStop?: () => void;
  onPermissionDecision?: (requestId: string, action: 'approve' | 'deny') => void;
  isLoading?: boolean;
  placeholder?: string;
  permissionRequest?: PermissionRequest | null;
}

export function InputArea({ onSubmit, onStop, onPermissionDecision, isLoading = false, placeholder = "Type a message...", permissionRequest }: InputAreaProps) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-resize textarea only when there's content
    if (textareaRef.current && message.trim()) {
      const scrollHeight = textareaRef.current.scrollHeight;
      const currentHeight = parseInt(textareaRef.current.style.height) || 80;
      
      // Only update if height actually needs to change
      if (Math.abs(scrollHeight - currentHeight) > 5) {
        textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
      }
    }
  }, [message]);

  useEffect(() => {
    // Handle click outside to blur
    const handleClickOutside = (event: MouseEvent) => {
      if (composerRef.current && !composerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
        // Let CSS handle the height transition
        if (textareaRef.current && !message.trim()) {
          textareaRef.current.style.height = '';
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
    
    // Reset textarea height - CSS will handle the transition
    if (textareaRef.current) {
      textareaRef.current.style.height = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
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
                      // Let CSS handle the transition
                      if (textareaRef.current && !message.trim()) {
                        textareaRef.current.style.height = '';
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
                      title="Approve permission"
                      onClick={() => onPermissionDecision?.(permissionRequest.id, 'approve')}
                    >
                      <Check size={18} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconButton} ${styles.permissionButton} ${styles.denyButton}`}
                      title="Deny permission"
                      onClick={() => onPermissionDecision?.(permissionRequest.id, 'deny')}
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
                    title="Send message (Ctrl/Cmd+Enter)"
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