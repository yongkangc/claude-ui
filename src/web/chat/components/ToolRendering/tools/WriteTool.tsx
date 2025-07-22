import React from 'react';
import { detectLanguageFromPath } from '../../../utils/language-detection';
import { DiffViewer } from './DiffViewer';
import styles from '../ToolRendering.module.css';

interface WriteToolProps {
  input: any;
  result: string;
  isError: boolean;
  isPending: boolean;
  workingDirectory?: string;
}

export function WriteTool({ input, result, isError, isPending, workingDirectory }: WriteToolProps) {

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
  const content = input?.content || '';
  const language = detectLanguageFromPath(filePath);

  return (
    <div className={styles.toolContent}>
      <DiffViewer
        oldValue=""
        newValue={content}
        language={language}
      />
    </div>
  );
}