import React, { useState, useEffect, useRef } from 'react';
import { Maximize2, Minimize2, CornerDownRight } from 'lucide-react';
import type { ChatMessage } from '../../../types';
import { MessageItem } from '../../MessageList/MessageItem';
import styles from '../ToolRendering.module.css';

interface TaskToolProps {
  input: any;
  result: string;
  toolUseId?: string;
  childrenMessages?: Record<string, ChatMessage[]>;
  toolResults?: Record<string, any>;
}

export function TaskTool({ 
  input, 
  result, 
  toolUseId, 
  childrenMessages = {}, 
  toolResults = {}
}: TaskToolProps) {
  const hasChildren = toolUseId && childrenMessages[toolUseId] && childrenMessages[toolUseId].length > 0;
  const children = toolUseId ? childrenMessages[toolUseId] || [] : [];
  const [isFullHeight, setIsFullHeight] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive (only when not in full height)
  useEffect(() => {
    if (!isFullHeight && contentRef.current && children.length > 0) {
      contentRef.current.scrollTo({
        top: contentRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [children.length, isFullHeight]);

  return (
    <>
      {hasChildren && (
        <div className={styles.toolContent}>
          <div className={styles.taskChildrenContainer}>
            <button
              className={styles.expandButton}
              onClick={() => setIsFullHeight(!isFullHeight)}
              title={isFullHeight ? "Collapse height" : "Expand height"}
            >
              {isFullHeight ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <div 
              ref={contentRef}
              className={`${styles.taskChildrenContent} ${isFullHeight ? styles.fullHeight : styles.autoScroll}`}
            >
              {children.map((childMessage) => (
                <MessageItem
                  key={childMessage.messageId}
                  message={childMessage}
                  toolResults={toolResults}
                />
              ))}
            </div>
          </div>
        </div>
      )}
      <div className={styles.toolContent}>
        <div className={styles.toolSummary}>
          <CornerDownRight size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Task completed
        </div>
      </div>
    </>
  );
}