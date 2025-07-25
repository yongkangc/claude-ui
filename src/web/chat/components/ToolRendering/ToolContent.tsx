import React, { useState } from 'react';
import { CornerDownRight } from 'lucide-react';
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages/messages';
import type { ChatMessage, ToolResult } from '../../types';
import { ReadTool } from './tools/ReadTool';
import { EditTool } from './tools/EditTool';
import { WriteTool } from './tools/WriteTool';
import { BashTool } from './tools/BashTool';
import { SearchTool } from './tools/SearchTool';
import { TodoTool } from './tools/TodoTool';
import { WebTool } from './tools/WebTool';
import { TaskTool } from './tools/TaskTool';
import { PlanTool } from './tools/PlanTool';
import { FallbackTool } from './tools/FallbackTool';
import styles from './ToolRendering.module.css';

interface ToolContentProps {
  toolName: string;
  toolInput: any;
  toolResult?: ToolResult;
  workingDirectory?: string;
  toolUseId?: string;
  childrenMessages?: Record<string, ChatMessage[]>;
  toolResults?: Record<string, any>;
}

export function ToolContent({ 
  toolName, 
  toolInput, 
  toolResult, 
  workingDirectory, 
  toolUseId, 
  childrenMessages, 
  toolResults
}: ToolContentProps) {
  const [isErrorExpanded, setIsErrorExpanded] = useState(false);
  // Extract result content - handle both string and ContentBlockParam[] formats
  const getResultContent = (): string => {
    if (!toolResult?.result) return '';
    
    if (typeof toolResult.result === 'string') {
      return toolResult.result;
    }
    
    if (Array.isArray(toolResult.result)) {
      return toolResult.result
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');
    }
    
    return '';
  };

  const resultContent = getResultContent();
  const isError = toolResult?.is_error === true;
  const isPending = toolResult?.status === 'pending';

  // Handle pending display at root level
  if (isPending) {
    return (
      <div className={styles.toolContent}>
        <div className={styles.pendingContent}>
          <span className={styles.pendingText}>Waiting approval...</span>
        </div>
      </div>
    );
  }

  // Handle error display at root level
  if (isError) {
    const errorMessage = resultContent || 'Tool execution failed';
    const firstLine = errorMessage.split('\n')[0].trim();
    const hasMultipleLines = errorMessage.includes('\n');
    
    return (
      <div className={styles.toolContent}>
        <div 
          className={`${styles.toolSummary} ${styles.expandable}`}
          onClick={() => setIsErrorExpanded(!isErrorExpanded)}
        >
          <CornerDownRight 
            size={12} 
            className={`${styles.chevron} ${isErrorExpanded ? styles.expanded : ''}`} 
          />
          <span style={{ color: 'var(--color-error)' }}>
            Error: {firstLine}
          </span>
        </div>
        
        {isErrorExpanded && (
          <div className={styles.errorContent}>
            {errorMessage}
          </div>
        )}
      </div>
    );
  }

  // Route to appropriate tool-specific component
  switch (toolName) {
    case 'Read':
      return (
        <ReadTool
          input={toolInput}
          result={resultContent}
          workingDirectory={workingDirectory}
        />
      );
    
    case 'Edit':
    case 'MultiEdit':
      return (
        <EditTool
          input={toolInput}
          result={resultContent}
          isMultiEdit={toolName === 'MultiEdit'}
          workingDirectory={workingDirectory}
        />
      );
    
    case 'Write':
      return (
        <WriteTool
          input={toolInput}
          result={resultContent}
          workingDirectory={workingDirectory}
        />
      );
    
    case 'Bash':
      return (
        <BashTool
          input={toolInput}
          result={resultContent}
        />
      );
    
    case 'Grep':
    case 'Glob':
    case 'LS':
      return (
        <SearchTool
          input={toolInput}
          result={resultContent}
          toolType={toolName}
        />
      );
    
    case 'TodoRead':
    case 'TodoWrite':
      return (
        <TodoTool
          input={toolInput}
          result={resultContent}
          isWrite={toolName === 'TodoWrite'}
        />
      );
    
    case 'WebSearch':
    case 'WebFetch':
      return (
        <WebTool
          input={toolInput}
          result={resultContent}
          toolType={toolName}
        />
      );
    
    case 'Task':
      return (
        <TaskTool
          input={toolInput}
          result={resultContent}
          toolUseId={toolUseId}
          childrenMessages={childrenMessages}
          toolResults={toolResults}
        />
      );
    
    case 'exit_plan_mode':
      return (
        <PlanTool
          input={toolInput}
          result={resultContent}
        />
      );
    
    default:
      return (
        <FallbackTool
          toolName={toolName}
          input={toolInput}
          result={resultContent}
        />
      );
  }
}