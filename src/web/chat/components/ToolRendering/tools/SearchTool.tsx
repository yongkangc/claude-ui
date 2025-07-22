import React, { useState } from 'react';
import { CornerDownRight } from 'lucide-react';
import { countLines, extractFileCount } from '../../../utils/tool-utils';
import styles from '../ToolRendering.module.css';

interface SearchToolProps {
  input: any;
  result: string;
  isError: boolean;
  isPending: boolean;
  toolType: 'Grep' | 'Glob' | 'LS';
}

export function SearchTool({ input, result, isError, isPending, toolType }: SearchToolProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isPending) {
    return <div className={styles.toolContent} />;
  }

  if (isError) {
    return (
      <div className={styles.toolContent}>
        <div className={styles.errorContent}>
          {result || `Error in ${toolType} operation`}
        </div>
      </div>
    );
  }

  const getSummaryText = (): string => {
    switch (toolType) {
      case 'Grep':
        const lineCount = countLines(result);
        return `Found ${lineCount} line${lineCount !== 1 ? 's' : ''}`;
      
      case 'Glob':
        const fileCount = countLines(result);
        return `Found ${fileCount} file${fileCount !== 1 ? 's' : ''}`;
      
      case 'LS':
        const pathCount = extractFileCount(result);
        return `Listed ${pathCount} path${pathCount !== 1 ? 's' : ''}`;
      
      default:
        return 'Search completed';
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
        {getSummaryText()}
      </div>
      
      {isExpanded && result && (
        <div className={styles.codeBlock}>
          <pre>{result}</pre>
        </div>
      )}
    </div>
  );
}