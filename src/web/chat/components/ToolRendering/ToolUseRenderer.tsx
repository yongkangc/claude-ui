import React from 'react';
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages/messages';
import { ToolLabel } from './ToolLabel';
import { ToolContent } from './ToolContent';

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
  workingDirectory?: string;
}

export function ToolUseRenderer({ toolUse, toolResult, workingDirectory }: ToolUseRendererProps) {
  return (
    <>
      <ToolLabel 
        toolName={toolUse.name}
        toolInput={toolUse.input}
        workingDirectory={workingDirectory}
      />
      <ToolContent
        toolName={toolUse.name}
        toolInput={toolUse.input}
        toolResult={toolResult}
        workingDirectory={workingDirectory}
      />
    </>
  );
}