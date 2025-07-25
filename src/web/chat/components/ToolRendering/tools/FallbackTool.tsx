import React, { useState } from 'react';
import { CornerDownRight } from 'lucide-react';
import styles from '../ToolRendering.module.css';

interface FallbackToolProps {
  toolName: string;
  input: any;
  result: string;
}

export function FallbackTool({ toolName, input, result }: FallbackToolProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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
        <CornerDownRight 
          size={12} 
          className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`} 
        />
        {toolName} completed
      </div>
      
      {isExpanded && (
        <div className={styles.codeBlock}>
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