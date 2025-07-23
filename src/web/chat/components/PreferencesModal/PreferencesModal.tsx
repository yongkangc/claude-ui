import React, { useEffect, useState } from 'react';
import styles from './PreferencesModal.module.css';
import { api } from '../../services/api';
import type { Preferences } from '../../types';

interface Props {
  onClose: () => void;
}

export function PreferencesModal({ onClose }: Props) {
  const [prefs, setPrefs] = useState<Preferences>({ colorScheme: 'light', language: 'en' });

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
        <button onClick={onClose} className={styles.closeButton}>Close</button>
      </div>
    </div>
  );
}
