import React from 'react';
import ReactMarkdown from 'react-markdown';
import styles from '../ToolRendering.module.css';

interface PlanToolProps {
  input: any;
  result: string;
}

export function PlanTool({ input, result }: PlanToolProps) {
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