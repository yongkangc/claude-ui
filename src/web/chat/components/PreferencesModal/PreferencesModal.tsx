import React, { useEffect, useState } from 'react';
import styles from './PreferencesModal.module.css';
import { api } from '../../services/api';
import type { Preferences } from '../../types';
import { Dialog } from '../Dialog';

interface Props {
  onClose: () => void;
}

export function PreferencesModal({ onClose }: Props) {
  const [prefs, setPrefs] = useState<Preferences>({ colorScheme: 'light', language: 'en' });
  const [archiveStatus, setArchiveStatus] = useState<string>('');

  useEffect(() => {
    api.getPreferences().then(setPrefs).catch(() => {});
  }, []);

  const update = async (updates: Partial<Preferences>) => {
    const updated = await api.updatePreferences(updates);
    setPrefs(updated);
    if (updates.colorScheme) {
      // For system theme, we need to determine the actual theme
      if (updates.colorScheme === 'system') {
        const systemTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', systemTheme);
      } else {
        document.documentElement.setAttribute('data-theme', updates.colorScheme);
      }
    }
  };

  const handleArchiveAll = async () => {
    if (!confirm('Are you sure you want to archive all sessions? This action cannot be undone.')) {
      return;
    }
    
    try {
      setArchiveStatus('Archiving...');
      const response = await fetch('/api/conversations/archive-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      if (data.success) {
        setArchiveStatus(data.message);
        // Clear the status after 3 seconds
        setTimeout(() => setArchiveStatus(''), 3000);
      } else {
        setArchiveStatus(`Error: ${data.error || 'Failed to archive sessions'}`);
      }
    } catch (error) {
      setArchiveStatus(`Error: ${error instanceof Error ? error.message : 'Failed to archive sessions'}`);
    }
  };

  return (
    <Dialog open={true} onClose={onClose} title="Preferences">
      <div className={styles.content}>
        <h2 className={styles.heading}>Preferences</h2>
        <label className={styles.label}>
          Color Scheme:
          <select
            className={styles.select}
            value={prefs.colorScheme}
            onChange={(e) => update({ colorScheme: e.target.value as 'light' | 'dark' | 'system' })}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </label>
        <label className={styles.label}>
          Language:
          <input
            className={styles.input}
            value={prefs.language}
            onChange={(e) => update({ language: e.target.value })}
          />
        </label>
        
        <div className={styles.sessionSection}>
          <h3 className={styles.sectionTitle}>Session Management</h3>
          <button 
            onClick={handleArchiveAll}
            className={styles.archiveButton}
          >
            Archive All Sessions
          </button>
          {archiveStatus && (
            <div className={`${styles.statusMessage} ${archiveStatus.startsWith('Error') ? styles.error : styles.success}`}>
              {archiveStatus}
            </div>
          )}
        </div>
        
        <button onClick={onClose} className={styles.closeButton}>Close</button>
      </div>
    </Dialog>
  );
}
