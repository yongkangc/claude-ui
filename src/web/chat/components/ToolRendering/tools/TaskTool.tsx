import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import styles from '../ToolRendering.module.css';

interface TaskToolProps {
  input: any;
  result: string;
  isError: boolean;
  isPending: boolean;
}

export function TaskTool({ input, result, isError, isPending }: TaskToolProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isPending) {
    return <div className={styles.toolContent} />;
  }

  return (
    <div className={styles.toolContent}>
      <div className={styles.collapsibleContainer}>
        <div 
          className={styles.collapsibleHeader}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <ChevronRight 
            size={12} 
            className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`} 
          />
          {input.description || 'Task'}
        </div>
        
        {isExpanded && (
          <div className={styles.collapsibleContent}>
            {isError ? (
              <div className={styles.errorContent}>
                {result || 'Task failed'}
              </div>
            ) : result ? (
              <div className={styles.codeBlock}>
                <pre>{result}</pre>
              </div>
            ) : (
              <div className={styles.pendingContent}>
                Task is running...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}