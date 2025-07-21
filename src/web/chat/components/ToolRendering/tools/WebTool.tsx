import React, { useState } from 'react';
import { ChevronRight, Globe } from 'lucide-react';
import { extractDomain } from '../../../utils/tool-utils';
import styles from '../ToolRendering.module.css';

interface WebToolProps {
  input: any;
  result: string;
  isError: boolean;
  isPending: boolean;
  toolType: 'WebSearch' | 'WebFetch';
}

export function WebTool({ input, result, isError, isPending, toolType }: WebToolProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isPending) {
    return (
      <div className={styles.toolContent}>
        <div className={styles.pendingContent}>
          <span className={styles.loadingSpinner}></span>
          {toolType === 'WebSearch' ? 'Searching web...' : 'Fetching content...'}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.toolContent}>
        <div className={styles.errorContent}>
          {result || `Error in ${toolType} operation`}
        </div>
      </div>
    );
  }

  const getSummaryText = (): string => {
    if (toolType === 'WebSearch') {
      // Could potentially extract timing information from result if available
      return 'Did 1 search';
    } else {
      // For WebFetch, could show size/status if available
      return 'Received content from URL';
    }
  };

  const getDomainPills = (): React.ReactNode => {
    // For WebSearch, we could parse the result to extract domains
    // For now, showing a placeholder implementation
    if (toolType === 'WebFetch' && input.url) {
      const domain = extractDomain(input.url);
      return (
        <div className={styles.searchResultPills}>
          <a
            href={input.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.searchResultPill}
          >
            <img 
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} 
              alt=""
              width={12}
              height={12}
            />
            <span>{domain}</span>
          </a>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={styles.toolContent}>
      <div 
        className={`${styles.toolSummary} ${styles.expandable}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <ChevronRight 
          size={12} 
          className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`} 
        />
        {getSummaryText()}
      </div>

      {getDomainPills()}
      
      {isExpanded && result && (
        <div className={styles.codeBlock}>
          <pre>{result}</pre>
        </div>
      )}
    </div>
  );
}