import React from 'react';
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages/messages';
import type { ChatMessage } from '../../types';
import { ToolLabel } from './ToolLabel';
import { ToolContent } from './ToolContent';
import { MessageItem } from '../MessageList/MessageItem';
import styles from '../MessageList/MessageList.module.css';

interface ToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: any;
}

interface ToolResult {
  status: 'pending' | 'completed';
  result?: string | ContentBlockParam[];
  is_error?: boolean;
}

interface ToolUseRendererProps {
  toolUse: ToolUse;
  toolResult?: ToolResult;
  toolResults?: Record<string, ToolResult>;
  workingDirectory?: string;
  childrenMessages?: Record<string, ChatMessage[]>;
  expandedTasks?: Set<string>;
  onToggleTaskExpanded?: (toolUseId: string) => void;
}

export function ToolUseRenderer({ 
  toolUse, 
  toolResult, 
  toolResults = {},
  workingDirectory,
  childrenMessages = {},
  expandedTasks = new Set(),
  onToggleTaskExpanded
}: ToolUseRendererProps) {
  const hasChildren = toolUse.name === 'Task' && childrenMessages[toolUse.id] && childrenMessages[toolUse.id].length > 0;
  const children = childrenMessages[toolUse.id] || [];
  
  return (
    <>
      <ToolLabel 
        toolName={toolUse.name}
        toolInput={toolUse.input}
        workingDirectory={workingDirectory}
      />
      {!hasChildren && (
        <ToolContent
          toolName={toolUse.name}
          toolInput={toolUse.input}
          toolResult={toolResult}
          workingDirectory={workingDirectory}
        />
      )}
      {hasChildren && (
        <div className={styles.nestedMessages}>
          {children.map((childMessage) => (
            <MessageItem
              key={childMessage.messageId}
              message={childMessage}
              toolResults={toolResults}
            />
          ))}
        </div>
      )}
    </>
  );
}