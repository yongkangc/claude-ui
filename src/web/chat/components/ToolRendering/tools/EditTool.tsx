import React from 'react';
import { detectLanguageFromPath } from '../../../utils/language-detection';
import { CodeHighlight } from '../../CodeHighlight';
import { DiffViewer } from './DiffViewer';
import styles from '../ToolRendering.module.css';

interface EditToolProps {
  input: any;
  result: string;
  isError: boolean;
  isPending: boolean;
  isMultiEdit?: boolean;
  workingDirectory?: string;
}

export function EditTool({ input, result, isError, isPending, isMultiEdit = false, workingDirectory }: EditToolProps) {
  // 从文件路径检测语言
  const filePath = input?.file_path || '';
  const language = detectLanguageFromPath(filePath);
  if (isPending) {
    return (
      <div className={styles.toolContent}>
        <div className={styles.pendingContent}>
          <span className={styles.loadingSpinner}></span>
          {isMultiEdit ? 'Applying multiple edits...' : 'Applying edit...'}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.toolContent}>
        <div className={styles.errorContent}>
          {result || 'Error applying edit'}
        </div>
      </div>
    );
  }

  // For MultiEdit, process all edits
  if (isMultiEdit && input.edits && Array.isArray(input.edits)) {
    return (
      <div className={styles.toolContent}>
        {input.edits.map((edit: any, index: number) => (
          <div key={index}>
            <DiffViewer
              oldValue={edit.old_string || ''}
              newValue={edit.new_string || ''}
              language={language}
            />
            {index < input.edits.length - 1 && (
              <div style={{ height: '8px' }} />
            )}
          </div>
        ))}
      </div>
    );
  }

  // For regular Edit, process single edit
  if (input.old_string !== undefined && input.new_string !== undefined) {
    return (
      <div className={styles.toolContent}>
        <DiffViewer
          oldValue={input.old_string}
          newValue={input.new_string}
          language={language}
        />
      </div>
    );
  }

  // Fallback if we can't parse the edit
  
  return (
    <div className={styles.toolContent}>
      {result ? (
        <CodeHighlight
          code={result}
          language={language}
          className={styles.codeBlock}
        />
      ) : (
        <div className={styles.codeBlock}>
          <pre>Edit completed successfully</pre>
        </div>
      )}
    </div>
  );
}