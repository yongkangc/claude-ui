import React, { useState } from 'react';
import { User, Bot, AlertCircle, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { JsonViewer } from '../JsonViewer/JsonViewer';
import type { ChatMessage } from '../../types';
import styles from './MessageList.module.css';

interface MessageItemProps {
  message: ChatMessage;
}

export function MessageItem({ message }: MessageItemProps) {
  // Initialize expanded blocks based on message type
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    // Auto-expand all blocks for assistant messages
    if (message.type === 'assistant' && Array.isArray(message.content)) {
      message.content.forEach((block: any, index: number) => {
        if (block.type === 'tool_use' || block.type === 'thinking') {
          initial.add(`${message.id}-${index}`);
        }
      });
    }
    return initial;
  });
  const [copiedBlocks, setCopiedBlocks] = useState<Set<string>>(new Set());

  const toggleBlock = (blockId: string) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  };

  const copyContent = async (content: string, blockId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedBlocks(prev => new Set(prev).add(blockId));
      setTimeout(() => {
        setCopiedBlocks(prev => {
          const next = new Set(prev);
          next.delete(blockId);
          return next;
        });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const renderIcon = () => {
    switch (message.type) {
      case 'user':
        return <User size={16} />;
      case 'assistant':
        return <Bot size={16} />;
      case 'error':
        return <AlertCircle size={16} className={styles.errorIcon} />;
      default:
        return <AlertCircle size={16} />;
    }
  };

  const renderContent = () => {
    if (message.type === 'error') {
      return <div className={styles.errorContent}>{String(message.content)}</div>;
    }

    // Handle different content formats
    if (typeof message.content === 'string') {
      return <div className={styles.textContent}>{message.content}</div>;
    }

    if (Array.isArray(message.content)) {
      return (
        <div className={styles.blocksContainer}>
          {message.content.map((block: any, index: number) => {
            const blockId = `${message.id}-${index}`;
            const isExpanded = expandedBlocks.has(blockId);
            const isCopied = copiedBlocks.has(blockId);

            if (block.type === 'text') {
              return (
                <div key={blockId} className={styles.textBlock}>
                  {block.text}
                </div>
              );
            }

            if (block.type === 'tool_use') {
              return (
                <div key={blockId} className={styles.toolBlock}>
                  <div className={styles.toolHeader}>
                    <button
                      className={styles.toggleButton}
                      onClick={() => toggleBlock(blockId)}
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <span className={styles.toolName}>{block.name}</span>
                    <button
                      className={styles.copyButton}
                      onClick={() => copyContent(JSON.stringify(block.input, null, 2), blockId)}
                      title="Copy input"
                    >
                      {isCopied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className={styles.toolContent}>
                      <JsonViewer data={block.input} />
                    </div>
                  )}
                </div>
              );
            }

            if (block.type === 'thinking') {
              return (
                <div key={blockId} className={styles.thinkingBlock}>
                  <div className={styles.thinkingHeader}>
                    <button
                      className={styles.toggleButton}
                      onClick={() => toggleBlock(blockId)}
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <span className={styles.thinkingLabel}>Thinking...</span>
                  </div>
                  {isExpanded && (
                    <div className={styles.thinkingContent}>
                      {block.thinking}
                    </div>
                  )}
                </div>
              );
            }

            // Default: render as JSON
            return (
              <div key={blockId} className={styles.jsonBlock}>
                <JsonViewer data={block} collapsed={message.type === 'user'} />
              </div>
            );
          })}
        </div>
      );
    }

    // Fallback: render as JSON
    return (
      <div className={styles.jsonBlock}>
        <JsonViewer data={message.content} collapsed={message.type === 'user'} />
      </div>
    );
  };

  return (
    <div className={`${styles.message} ${styles[message.type]}`}>
      <div className={styles.messageIcon}>{renderIcon()}</div>
      <div className={styles.messageContent}>
        <div className={styles.messageHeader}>
          <span className={styles.messageType}>{message.type}</span>
          <span className={styles.messageTime}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>
        {renderContent()}
        {message.isStreaming && (
          <div className={styles.streamingIndicator}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
      </div>
    </div>
  );
}