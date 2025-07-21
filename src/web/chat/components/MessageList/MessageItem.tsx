import React, { useState } from 'react';
import { Copy, Check, Code, Globe, Settings } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { JsonViewer } from '../JsonViewer/JsonViewer';
import { ToolUseRenderer } from '../ToolRendering/ToolUseRenderer';
import type { ChatMessage } from '../../types';
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages/messages';
import styles from './MessageList.module.css';

interface MessageItemProps {
  message: ChatMessage;
  toolResults?: Record<string, { status: 'pending' | 'completed'; result?: string | ContentBlockParam[] }>;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
}

export function MessageItem({ message, toolResults = {}, isFirstInGroup = true, isLastInGroup = true }: MessageItemProps) {
  const [copiedBlocks, setCopiedBlocks] = useState<Set<string>>(new Set());

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

  // Handle user messages
  if (message.type === 'user') {
    const content = typeof message.content === 'string' 
      ? message.content 
      : Array.isArray(message.content) 
        ? message.content.filter((block: any) => block.type === 'text').map((block: any) => block.text).join('\n')
        : '';
    
    return (
      <div className={styles.userMessage}>
        <div className={styles.userMessageContent}>
          <div className={styles.userMessageText}>
            {content}
          </div>
          <button
            className={styles.userMessageCopy}
            onClick={() => copyContent(content, message.messageId)}
            title="Copy"
          >
            {copiedBlocks.has(message.messageId) ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
      </div>
    );
  }

  // Handle assistant messages with timeline
  if (message.type === 'assistant') {
    const renderContent = () => {
      if (typeof message.content === 'string') {
        return (
          <div className={styles.assistantBlock}>
            <div className={styles.timelineIcon}>
              <div className={styles.timelineDot} />
            </div>
            <div className={styles.assistantContent}>
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          </div>
        );
      }

      if (Array.isArray(message.content)) {
        return message.content.map((block: any, index: number) => {
          const blockId = `${message.messageId}-${index}`;
          const isLastBlock = index === message.content.length - 1;

          if (block.type === 'text') {
            return (
              <div key={blockId} className={styles.assistantBlock}>
                <div className={styles.timelineIcon}>
                  <div className={styles.timelineDot} />
                </div>
                <div className={styles.assistantContent}>
                  <ReactMarkdown>{block.text}</ReactMarkdown>
                </div>
              </div>
            );
          }

          if (block.type === 'tool_use') {
            const toolResult = toolResults[block.id];
            
            // Check if this is a web search tool for icon selection
            const isWebSearch = block.name === 'WebSearch' || block.name === 'WebFetch';
            
            return (
              <div key={blockId} className={styles.assistantBlock}>
                <div className={styles.timelineIcon}>
                  {isWebSearch ? <Globe size={15} /> : <Settings size={15} />}
                </div>
                <div className={styles.toolUseContent}>
                  <ToolUseRenderer
                    toolUse={block}
                    toolResult={toolResult}
                    workingDirectory={message.workingDirectory}
                  />
                </div>
              </div>
            );
          }

          // Default: render as JSON
          return (
            <div key={blockId} className={styles.assistantBlock}>
              <div className={styles.timelineIcon}>
                <Code size={15} />
              </div>
              <div className={styles.assistantContent}>
                <JsonViewer data={block} />
              </div>
            </div>
          );
        });
      }

      // Fallback
      return (
        <div className={styles.assistantBlock}>
          <div className={styles.timelineIcon}>
            <div className={styles.timelineDot} />
          </div>
          <div className={styles.assistantContent}>
            <JsonViewer data={message.content} />
          </div>
        </div>
      );
    };

    return (
      <div className={`${styles.assistantMessage} ${!isLastInGroup ? styles.notLastInGroup : ''}`}>
        {!isLastInGroup && <div className={styles.timelineConnector} />}
        {renderContent()}
      </div>
    );
  }

  // Handle error messages
  if (message.type === 'error') {
    return (
      <div className={styles.errorMessage}>
        <div className={styles.errorContent}>
          {String(message.content)}
        </div>
      </div>
    );
  }

  // Default fallback
  return null;
}

