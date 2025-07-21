import React from 'react';
import { formatDiffLines } from '../../../utils/tool-utils';
import styles from '../ToolRendering.module.css';

interface EditToolProps {
  input: any;
  result: string;
  isError: boolean;
  isPending: boolean;
  isMultiEdit?: boolean;
}

export function EditTool({ input, result, isError, isPending, isMultiEdit = false }: EditToolProps) {
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
        <div className={styles.diffContainer}>
          {input.edits.map((edit: any, index: number) => {
            const diffLines = formatDiffLines(edit.old_string || '', edit.new_string || '');
            return (
              <div key={index}>
                {diffLines.map((line, lineIndex) => (
                  <div 
                    key={`${index}-${lineIndex}`}
                    className={`${styles.diffLine} ${
                      line.type === 'remove' ? styles.diffLineRemove : styles.diffLineAdd
                    }`}
                  >
                    {line.type === 'remove' ? '-' : '+'}
                    {line.content}
                  </div>
                ))}
                {index < input.edits.length - 1 && (
                  <div className={styles.diffLine} style={{ backgroundColor: 'transparent', color: 'var(--color-text-secondary)' }}>
                    ...
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // For regular Edit, process single edit
  if (input.old_string !== undefined && input.new_string !== undefined) {
    const diffLines = formatDiffLines(input.old_string, input.new_string);
    
    return (
      <div className={styles.toolContent}>
        <div className={styles.diffContainer}>
          {diffLines.map((line, index) => (
            <div 
              key={index}
              className={`${styles.diffLine} ${
                line.type === 'remove' ? styles.diffLineRemove : styles.diffLineAdd
              }`}
            >
              {line.type === 'remove' ? '-' : '+'}
              {line.content}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fallback if we can't parse the edit
  return (
    <div className={styles.toolContent}>
      <div className={styles.codeBlock}>
        <pre>{result || 'Edit completed successfully'}</pre>
      </div>
    </div>
  );
}