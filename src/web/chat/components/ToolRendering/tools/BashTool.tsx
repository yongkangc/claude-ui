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
      {isError ? (
        <div className={`${styles.codeBlock} ${styles.errorCode}`}>
          <div className={styles.scrollableCode}>
            <pre>{displayContent}</pre>
          </div>
        </div>
      ) : (
        <div className={styles.scrollableCode}>
          {command && (
            <CodeHighlight
              code={`$ ${command}`}
              language="bash"
              className={`${styles.codeBlock} ${result ? styles.bashCommand : ''}`}
            />
          )}
          {result && (
            <div className={`${styles.codeBlock} ${styles.bashOutput}`}>
              <pre>{displayContent}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}