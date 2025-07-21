import React from 'react';
import ReactMarkdown from 'react-markdown';
import styles from '../ToolRendering.module.css';

interface PlanToolProps {
  input: any;
  result: string;
  isError: boolean;
  isPending: boolean;
}

export function PlanTool({ input, result, isError, isPending }: PlanToolProps) {
  if (isPending) {
    return (
      <div className={styles.toolContent}>
        <div className={styles.pendingContent}>
          <span className={styles.loadingSpinner}></span>
          Creating plan...
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.toolContent}>
        <div className={styles.errorContent}>
          {result || 'Error creating plan'}
        </div>
      </div>
    );
  }

  // Use the plan from input.plan as specified in the requirements
  const planContent = input.plan || result || 'No plan provided';

  return (
    <div className={styles.toolContent}>
      <div className={styles.planContent}>
        <ReactMarkdown>{planContent}</ReactMarkdown>
      </div>
    </div>
  );
}