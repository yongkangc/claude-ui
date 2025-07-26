import React, { useState } from 'react';
import { Copy, Check, Code, Globe, Settings, FileText, Edit, Terminal, Search, List, CheckSquare, ExternalLink, Play, FileEdit, ClipboardList, Maximize2, Minimize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { JsonViewer } from '../JsonViewer/JsonViewer';
import { ToolUseRenderer } from '../ToolRendering/ToolUseRenderer';
import { CodeHighlight } from '../CodeHighlight';
import type { ChatMessage, ToolResult } from '../../types';
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages/messages';
import styles from './MessageList.module.css';

interface MessageItemProps {
  message: ChatMessage;
  toolResults?: Record<string, ToolResult>;
  childrenMessages?: Record<string, ChatMessage[]>;
  expandedTasks?: Set<string>;
  onToggleTaskExpanded?: (toolUseId: string) => void;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  isStreaming?: boolean;
}

function getToolIcon(toolName: string) {
  switch (toolName) {
    case 'Read':
      return <FileText size={15} />;
    case 'Edit':
    case 'MultiEdit':
      return <Edit size={15} />;
    case 'Bash':
      return <Terminal size={15} />;
    case 'Grep':
    case 'Glob':
      return <Search size={15} />;
    case 'LS':
      return <List size={15} />;
    case 'TodoRead':
    case 'TodoWrite':
      return <CheckSquare size={15} />;
    case 'WebSearch':
      return <Globe size={15} />;
    case 'WebFetch':
      return <ExternalLink size={15} />;
    case 'Task':
      return <Play size={15} />;
    case 'exit_plan_mode':
      return <ClipboardList size={15} />;
    case 'Write':
      return <FileEdit size={15} />;
    default:
      return <Settings size={15} />;
  }
}

// Custom components for ReactMarkdown
const markdownComponents = {
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : 'text';
    
    if (!inline && match) {
      return (
        <CodeHighlight
          code={String(children).replace(/\n$/, '')}
          language={language}
          className={styles.codeBlock}
        />
      );
    }
    
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }
};

export function MessageItem({ 
  message, 
  toolResults = {}, 
  childrenMessages = {}, 
  expandedTasks = new Set(), 
  onToggleTaskExpanded,
  isFirstInGroup = true, 
  isLastInGroup = true,
  isStreaming = false
}: MessageItemProps) {
  const [copiedBlocks, setCopiedBlocks] = useState<Set<string>>(new Set());
  const [isUserMessageExpanded, setIsUserMessageExpanded] = useState(false);

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
    
    const lines = content.split('\n');
    const shouldShowExpandButton = lines.length > 8;
    const displayLines = isUserMessageExpanded ? lines : lines.slice(0, 8);
    const hiddenLinesCount = lines.length - 8;
    const displayContent = displayLines.join('\n');
    
    return (
      <div className={styles.userMessage}>
        <div className={styles.userMessageContent} style={{ position: 'relative' }}>
          {shouldShowExpandButton && (
            <button
              onClick={() => setIsUserMessageExpanded(!isUserMessageExpanded)}
              title={isUserMessageExpanded ? "Show fewer lines" : "Show all lines"}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                width: '24px',
                height: '24px',
                border: 'none',
                background: 'none',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                zIndex: 10,
              }}
            >
              {isUserMessageExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}
          <div className={styles.userMessageText}>
            {displayContent}
            {!isUserMessageExpanded && shouldShowExpandButton && (
              <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                {'\n'}... +{hiddenLinesCount} lines
              </span>
            )}
          </div>
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
              <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
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
                  <ReactMarkdown components={markdownComponents}>{block.text}</ReactMarkdown>
                </div>
              </div>
            );
          }

          if (block.type === 'thinking') {
            return (
              <div key={blockId} className={styles.assistantBlock}>
                <div className={styles.timelineIcon}>
                  <div className={styles.timelineDot} />
                </div>
                <div className={styles.thinkingContent}>
                  <ReactMarkdown components={markdownComponents}>{block.thinking}</ReactMarkdown>
                </div>
              </div>
            );
          }

          if (block.type === 'tool_use') {
            const toolResult = toolResults[block.id];
            const isLoading = !toolResult || toolResult.status === 'pending';
            const shouldBlink = isLoading && isStreaming;
            
            return (
              <div key={blockId} className={styles.assistantBlock}>
                <div className={`${styles.timelineIcon} ${shouldBlink ? styles.timelineIconLoading : ''}`}>
                  {getToolIcon(block.name)}
                </div>
                <div className={styles.toolUseContent}>
                  <ToolUseRenderer
                    toolUse={block}
                    toolResult={toolResult}
                    toolResults={toolResults}
                    workingDirectory={message.workingDirectory}
                    childrenMessages={childrenMessages}
                    expandedTasks={expandedTasks}
                    onToggleTaskExpanded={onToggleTaskExpanded}
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

