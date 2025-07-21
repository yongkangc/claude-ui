import React from 'react';
import styles from '../ToolRendering.module.css';

interface BashToolProps {
  input: any;
  result: string;
  isError: boolean;
  isPending: boolean;
}

export function BashTool({ input, result, isError, isPending }: BashToolProps) {
  if (isPending) {
    return (
      <div className={styles.toolContent}>
        <div className={styles.pendingContent}>
          <span className={styles.loadingSpinner}></span>
          Executing command...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.toolContent}>
      <div className={`${styles.codeBlock} ${isError ? styles.errorCode : ''}`}>
        <div className={styles.scrollableCode}>
          <pre>{result || 'Command completed'}</pre>
        </div>
      </div>
    </div>
  );
}