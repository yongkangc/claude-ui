import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import styles from '../ToolRendering.module.css';

interface FallbackToolProps {
  toolName: string;
  input: any;
  result: string;
  isError: boolean;
  isPending: boolean;
}

export function FallbackTool({ toolName, input, result, isError, isPending }: FallbackToolProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isPending) {
    return <div className={styles.toolContent} />;
  }

  const formatContent = (content: string): string => {
    try {
      // Try to parse and format as JSON if possible
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // If not JSON, return as-is
      return content;
    }
  };

  return (
    <div className={styles.toolContent}>
      <div 
        className={`${styles.toolSummary} ${styles.expandable}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <ChevronRight 
          size={12} 
          className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`} 
        />
        {toolName} completed
      </div>
      
      {isExpanded && (
        <div className={`${styles.codeBlock} ${isError ? styles.errorCode : ''}`}>
          <pre>{formatContent(result || 'No result')}</pre>
        </div>
      )}
      
      {/* Always show input in expanded state for debugging */}
      {isExpanded && input && (
        <div className={styles.jsonContent}>
          <strong>Input:</strong>
          <pre>{JSON.stringify(input, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}