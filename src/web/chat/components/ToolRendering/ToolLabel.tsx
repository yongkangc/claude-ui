import React from 'react';
import { formatFilePath, formatToolInput, extractDomain } from '../../utils/tool-utils';
import styles from './ToolRendering.module.css';

interface ToolLabelProps {
  toolName: string;
  toolInput: any;
  workingDirectory?: string;
}

export function ToolLabel({ toolName, toolInput, workingDirectory }: ToolLabelProps) {
  console.debug('ToolLabel called with:', { toolName, toolInput, workingDirectory });
  
  const generateLabel = (): string => {
    switch (toolName) {
      case 'Read': {
        const filePath = formatFilePath(toolInput.file_path, workingDirectory);
        const offset = toolInput.offset;
        const limit = toolInput.limit;
        
        let pathWithRange = filePath;
        
        if (offset !== undefined && limit !== undefined) {
          pathWithRange = `${filePath}:${offset},${offset + limit}`;
        } else if (offset !== undefined) {
          pathWithRange = `${filePath}:${offset}`;
        } else if (limit !== undefined) {
          pathWithRange = `${filePath}:0,${limit}`;
        }
        
        return `Read(${pathWithRange})`;
      }
      
      case 'Edit':
        return `Update(${formatFilePath(toolInput.file_path, workingDirectory)})`;
      
      case 'MultiEdit':
        return `MultiEdit(${formatFilePath(toolInput.file_path, workingDirectory)})`;
      
      case 'Bash':
        return `Bash(${toolInput.command || ''})`;
      
      case 'Grep':
        return `Search(pattern: "${toolInput.pattern || ''}", path: "${toolInput.path || ''}")`;
      
      case 'Glob':
        return `Search(pattern: "${toolInput.pattern || ''}", path: "${toolInput.path || ''}")`;
      
      case 'LS':
        return `List(${formatFilePath(toolInput.path, workingDirectory)})`;
      
      case 'TodoRead':
        return 'Read Todos';
      
      case 'TodoWrite':
        return 'Update Todos';
      
      case 'WebSearch':
        return `Web Search("${toolInput.query || ''}")`;
      
      case 'WebFetch':
        return `Fetch(${toolInput.url || ''})`;
      
      case 'Task':
        return `Task(${toolInput.description || ''})`;
      
      case 'exit_plan_mode':
        return 'Plan';
      
      default:
        // Fallback for any unspecified tool
        return `${toolName}(${formatToolInput(toolInput)})`;
    }
  };

  return (
    <div className={styles.toolLabel}>
      {generateLabel()}
    </div>
  );
}