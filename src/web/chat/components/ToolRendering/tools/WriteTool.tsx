import React, { useState } from 'react';
import { CornerDownRight } from 'lucide-react';
import { formatFilePath } from '../../../utils/tool-utils';
import { detectLanguageFromPath } from '../../../utils/language-detection';
import { CodeHighlight } from '../../CodeHighlight';
import styles from '../ToolRendering.module.css';

interface WriteToolProps {
  input: any;
  result: string;
  isError: boolean;
  isPending: boolean;
  workingDirectory?: string;
}

export function WriteTool({ input, result, isError, isPending, workingDirectory }: WriteToolProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isPending) {
    return (
      <div className={styles.toolContent}>
        <div className={styles.pendingContent}>
          <span className={styles.loadingSpinner}></span>
          Writing file...
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.toolContent}>
        <div className={styles.errorContent}>
          {result || 'Error writing file'}
        </div>
      </div>
    );
  }

  const filePath = input?.file_path || '';
  const formattedPath = formatFilePath(filePath, workingDirectory);
  const content = input?.content || '';
  const language = detectLanguageFromPath(filePath);

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
        Wrote to {formattedPath}
      </div>
      
      {isExpanded && content && (
        <CodeHighlight
          code={content}
          language={language}
          className={styles.codeBlock}
        />
      )}
    </div>
  );
}