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
      document.documentElement.setAttribute('data-theme', updates.colorScheme);
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
            onChange={(e) => update({ colorScheme: e.target.value as 'light' | 'dark' })}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
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
