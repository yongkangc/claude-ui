import React, { useState } from 'react';
import { CornerDownRight } from 'lucide-react';
import { countLines } from '../../../utils/tool-utils';
import { detectLanguageFromPath } from '../../../utils/language-detection';
import { CodeHighlight } from '../../CodeHighlight';
import styles from '../ToolRendering.module.css';

interface ReadToolProps {
  input: any;
  result: string;
  isError: boolean;
  isPending: boolean;
  workingDirectory?: string;
}

export function ReadTool({ input, result, isError, isPending, workingDirectory }: ReadToolProps) {
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
  const filePath = input?.file_path || '';
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
        Read {lineCount} line{lineCount !== 1 ? 's' : ''}
      </div>
      
      {isExpanded && result && (
        <CodeHighlight
          code={result}
          language={language}
          showLineNumbers={true}
          className={styles.codeBlock}
        />
      )}
    </div>
  );
}