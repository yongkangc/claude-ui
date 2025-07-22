import React from 'react';
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages/messages';
import type { ChatMessage } from '../../types';
import { ReadTool } from './tools/ReadTool';
import { EditTool } from './tools/EditTool';
import { BashTool } from './tools/BashTool';
import { SearchTool } from './tools/SearchTool';
import { TodoTool } from './tools/TodoTool';
import { WebTool } from './tools/WebTool';
import { TaskTool } from './tools/TaskTool';
import { PlanTool } from './tools/PlanTool';
import { FallbackTool } from './tools/FallbackTool';

interface ToolResult {
  status: 'pending' | 'completed';
  result?: string | ContentBlockParam[];
  is_error?: boolean;
}

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

  // Route to appropriate tool-specific component
  switch (toolName) {
    case 'Read':
      return (
        <ReadTool
          input={toolInput}
          result={resultContent}
          isError={isError}
          isPending={isPending}
          workingDirectory={workingDirectory}
        />
      );
    
    case 'Edit':
    case 'MultiEdit':
      return (
        <EditTool
          input={toolInput}
          result={resultContent}
          isError={isError}
          isPending={isPending}
          isMultiEdit={toolName === 'MultiEdit'}
        />
      );
    
    case 'Bash':
      return (
        <BashTool
          input={toolInput}
          result={resultContent}
          isError={isError}
          isPending={isPending}
        />
      );
    
    case 'Grep':
    case 'Glob':
    case 'LS':
      return (
        <SearchTool
          input={toolInput}
          result={resultContent}
          isError={isError}
          isPending={isPending}
          toolType={toolName}
        />
      );
    
    case 'TodoRead':
    case 'TodoWrite':
      return (
        <TodoTool
          input={toolInput}
          result={resultContent}
          isError={isError}
          isPending={isPending}
          isWrite={toolName === 'TodoWrite'}
        />
      );
    
    case 'WebSearch':
    case 'WebFetch':
      return (
        <WebTool
          input={toolInput}
          result={resultContent}
          isError={isError}
          isPending={isPending}
          toolType={toolName}
        />
      );
    
    case 'Task':
      return (
        <TaskTool
          input={toolInput}
          result={resultContent}
          isError={isError}
          isPending={isPending}
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
          isError={isError}
          isPending={isPending}
        />
      );
    
    default:
      return (
        <FallbackTool
          toolName={toolName}
          input={toolInput}
          result={resultContent}
          isError={isError}
          isPending={isPending}
        />
      );
  }
}