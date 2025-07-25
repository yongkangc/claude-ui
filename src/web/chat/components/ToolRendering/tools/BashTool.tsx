import React from 'react';
import { CodeHighlight } from '../../CodeHighlight';
import styles from '../ToolRendering.module.css';

interface BashToolProps {
  input: any;
  result: string;
  workingDirectory?: string;
}

export function BashTool({ input, result }: BashToolProps) {
  return (
    <div className={styles.toolContent}>
      <CodeHighlight
        code={result || '(No content)'}
        language="text"
        showLineNumbers={false}
        className={styles.codeBlock}
      />
    </div>
  );
}