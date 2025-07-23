import React from 'react';
import { CodeHighlight } from '../../CodeHighlight';
import styles from '../ToolRendering.module.css';

interface BashToolProps {
  input: any;
  result: string;
  isError: boolean;
  isPending: boolean;
}

export function BashTool({ input, result, isError, isPending }: BashToolProps) {
  if (isPending) {
    return <div className={styles.toolContent} />;
  }

  const command = input?.command || '';
  const displayContent = result || 'Command completed';
  
  return (
    <div className={styles.toolContent}>
      <div className={`${styles.codeBlock} ${isError ? styles.errorCode : ''}`}>
        <div className={styles.scrollableCode}>
          <pre>{result || '(No content)'}</pre>
        </div>
      </div>
    </div>
  );
}