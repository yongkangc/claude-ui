import React from 'react';
import { Layout } from '../Layout/Layout';
import { LogViewer } from '../LogViewer/LogViewer';
import styles from './LogPage.module.css';

export function LogPage() {
  return (
    <Layout>
      <div className={styles.container}>
        <h1 className={styles.title}>Server Logs</h1>
        <div className={styles.logViewerWrapper}>
          <LogViewer />
        </div>
      </div>
    </Layout>
  );
}