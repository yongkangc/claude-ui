import { useState, useEffect } from 'react';
import type { Theme } from '../types';
import { api } from '../services/api';

const THEME_KEY = 'ccui-theme';

export function useTheme(): Theme {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    // Check localStorage first
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    
    // Then check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    
    return 'light';
  });

  useEffect(() => {
    api.getPreferences().then(prefs => {
      if (prefs.colorScheme === 'light' || prefs.colorScheme === 'dark') {
        setMode(prefs.colorScheme);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem(THEME_KEY, mode);
  }, [mode]);

  useEffect(() => {
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(THEME_KEY)) {
        setMode(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggle = async () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    try {
      await api.updatePreferences({ colorScheme: newMode });
    } catch {
      // ignore
    }
  };

  return { mode, toggle };
}