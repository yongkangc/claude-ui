import React, { useState } from 'react';
import { CornerDownRight } from 'lucide-react';
import { countLines } from '../../../utils/tool-utils';
import { detectLanguageFromPath } from '../../../utils/language-detection';
import { CodeHighlight } from '../../CodeHighlight';
import styles from '../ToolRendering.module.css';

interface ReadToolProps {
  input: any;
  result: string;
  workingDirectory?: string;
}

function cleanFileContent(content: string): string {
  // Remove system-reminder tags and their content
  let cleaned = content.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '');
  
  // Remove line numbers with arrow format (e.g., "     1→" or "    10→")
  cleaned = cleaned.replace(/^\s*\d+→/gm, '');
  
  // Trim any extra whitespace at the end
  return cleaned.trimEnd();
}

export function ReadTool({ input, result, workingDirectory }: ReadToolProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const cleanedContent = cleanFileContent(result);
  const lineCount = countLines(cleanedContent);
  const filePath = input?.file_path || '';
  const language = detectLanguageFromPath(filePath);

  return (
    <div className={styles.toolContent}>
      <div 
        className={`${styles.toolSummary} ${styles.expandable}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CornerDownRight 
          size={12} 
          className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`} 
        />
        Read {lineCount} line{lineCount !== 1 ? 's' : ''}
      </div>
      
      {isExpanded && cleanedContent && (
        <CodeHighlight
          code={cleanedContent}
          language={language}
          showLineNumbers={true}
          className={styles.codeBlock}
        />
      )}
    </div>
  );
}