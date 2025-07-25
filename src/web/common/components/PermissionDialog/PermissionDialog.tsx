import React from 'react';
import { ToolLabel } from '../../../chat/components/ToolRendering/ToolLabel';
import { ToolContent } from '../../../chat/components/ToolRendering/ToolContent';
import type { PermissionRequest } from '@/types';
import styles from './PermissionDialog.module.css';

interface PermissionDialogProps {
  permissionRequest: PermissionRequest;
  isVisible: boolean;
}

export function PermissionDialog({ permissionRequest, isVisible }: PermissionDialogProps) {
  if (!isVisible || !permissionRequest) {
    return null;
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <h3 className={styles.title}>Permission Request</h3>
        </div>
        
        <div className={styles.content}>
          <div className={styles.toolSection}>
            <ToolLabel 
              toolName={permissionRequest.toolName}
              toolInput={permissionRequest.toolInput}
            />
          </div>
          
            <div className={styles.toolInputDisplay}>
              <ToolContent
                toolName={permissionRequest.toolName}
                toolInput={permissionRequest.toolInput}
              />
            </div>
        </div>
      </div>
    </div>
  );
}