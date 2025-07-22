import React from 'react';
import { formatFilePath, formatToolInput, extractDomain } from '../../utils/tool-utils';
import styles from './ToolRendering.module.css';

interface ToolLabelProps {
  toolName: string;
  toolInput: any;
  workingDirectory?: string;
  onClick?: () => void;
}

export function ToolLabel({ toolName, toolInput, workingDirectory, onClick }: ToolLabelProps) {
  console.debug('ToolLabel called with:', { toolName, toolInput, workingDirectory });
  
  const generateLabel = (): React.ReactNode => {
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
        
        return (
          <>
            <span className={styles.toolName}>Read</span>
            <span className={styles.toolParams}>({pathWithRange})</span>
          </>
        );
      }
      
      case 'Edit':
        return (
          <>
            <span className={styles.toolName}>Update</span>
            <span className={styles.toolParams}>({formatFilePath(toolInput.file_path, workingDirectory)})</span>
          </>
        );
      
      case 'MultiEdit':
        return (
          <>
            <span className={styles.toolName}>MultiEdit</span>
            <span className={styles.toolParams}>({formatFilePath(toolInput.file_path, workingDirectory)})</span>
          </>
        );
      
      case 'Bash':
        return (
          <>
            <span className={styles.toolName}>Bash</span>
            <span className={styles.toolParams}>({toolInput.command || ''})</span>
          </>
        );
      
      case 'Grep':
        return (
          <>
            <span className={styles.toolName}>Search</span>
            <span className={styles.toolParams}>(pattern: "{toolInput.pattern || ''}", path: "{toolInput.path || ''}")</span>
          </>
        );
      
      case 'Glob':
        return (
          <>
            <span className={styles.toolName}>Search</span>
            <span className={styles.toolParams}>(pattern: "{toolInput.pattern || ''}", path: "{toolInput.path || ''}")</span>
          </>
        );
      
      case 'LS':
        return (
          <>
            <span className={styles.toolName}>List</span>
            <span className={styles.toolParams}>({formatFilePath(toolInput.path, workingDirectory)})</span>
          </>
        );
      
      case 'TodoRead':
        return <span className={styles.toolName}>Read Todos</span>;
      
      case 'TodoWrite':
        return <span className={styles.toolName}>Update Todos</span>;
      
      case 'WebSearch':
        return (
          <>
            <span className={styles.toolName}>Web Search</span>
            <span className={styles.toolParams}>("{toolInput.query || ''}")</span>
          </>
        );
      
      case 'WebFetch':
        return (
          <>
            <span className={styles.toolName}>Fetch</span>
            <span className={styles.toolParams}>({toolInput.url || ''})</span>
          </>
        );
      
      case 'Task':
        return (
          <>
            <span className={styles.toolName}>Task</span>
            <span className={styles.toolParams}>({toolInput.description || ''})</span>
          </>
        );
      
      case 'exit_plan_mode':
        return <span className={styles.toolName}>Plan</span>;
      
      default:
        // Fallback for any unspecified tool
        return (
          <>
            <span className={styles.toolName}>{toolName}</span>
            <span className={styles.toolParams}>({formatToolInput(toolInput)})</span>
          </>
        );
    }
  };

  return (
    <div 
      className={styles.toolLabel} 
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      {generateLabel()}
    </div>
  );
}