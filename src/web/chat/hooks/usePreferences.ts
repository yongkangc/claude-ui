import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Preferences } from '../types';

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences | null>(null);

  useEffect(() => {
    api.getPreferences().then(setPrefs).catch(() => {});
  }, []);

  const update = async (updates: Partial<Preferences>) => {
    const updated = await api.updatePreferences(updates);
    setPrefs(updated);
  };

  return { preferences: prefs, update };
}
