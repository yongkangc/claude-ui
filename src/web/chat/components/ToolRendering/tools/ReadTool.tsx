import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { countLines } from '../../../utils/tool-utils';
import styles from '../ToolRendering.module.css';

interface ReadToolProps {
  input: any;
  result: string;
  isError: boolean;
  isPending: boolean;
  workingDirectory?: string;
}

export function ReadTool({ input, result, isError, isPending }: ReadToolProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isPending) {
    return (
      <div className={styles.toolContent}>
        <div className={styles.pendingContent}>
          <span className={styles.loadingSpinner}></span>
          Reading file...
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.toolContent}>
        <div className={styles.errorContent}>
          {result || 'Error reading file'}
        </div>
      </div>
    );
  }

  const lineCount = countLines(result);

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
        Read {lineCount} line{lineCount !== 1 ? 's' : ''}
      </div>
      
      {isExpanded && result && (
        <div className={styles.codeBlock}>
          <pre>{result}</pre>
        </div>
      )}
    </div>
  );
}