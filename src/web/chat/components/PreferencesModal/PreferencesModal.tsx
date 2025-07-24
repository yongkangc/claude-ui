import React, { useEffect, useState } from 'react';
import styles from './PreferencesModal.module.css';
import { api } from '../../services/api';
import type { Preferences } from '../../types';

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
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2>Preferences</h2>
        <label>
          Color Scheme:
          <select
            value={prefs.colorScheme}
            onChange={(e) => update({ colorScheme: e.target.value as 'light' | 'dark' | 'system' })}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </label>
        <label>
          Language:
          <input
            value={prefs.language}
            onChange={(e) => update({ language: e.target.value })}
          />
        </label>
        
        <div style={{ marginTop: '20px', borderTop: '1px solid var(--color-border)', paddingTop: '20px' }}>
          <h3 style={{ marginBottom: '10px' }}>Session Management</h3>
          <button 
            onClick={handleArchiveAll}
            style={{ 
              backgroundColor: '#e74c3c',
              color: 'white',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '10px'
            }}
          >
            Archive All Sessions
          </button>
          {archiveStatus && (
            <div style={{ 
              marginTop: '10px', 
              padding: '8px',
              backgroundColor: archiveStatus.startsWith('Error') ? '#ffe6e6' : '#e6ffe6',
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              {archiveStatus}
            </div>
          )}
        </div>
        
        <button onClick={onClose} className={styles.closeButton}>Close</button>
      </div>
    </div>
  );
}
