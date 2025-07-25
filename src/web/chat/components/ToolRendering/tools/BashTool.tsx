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

  return (
    <div className={styles.toolContent}>
      <CodeHighlight
        code={result || '(No content)'}
        language="text"
        showLineNumbers={false}
        className={`${styles.codeBlock} ${isError ? styles.errorCode : ''}`}
      />
    </div>
  );
}