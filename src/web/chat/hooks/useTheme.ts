import { useState, useEffect } from 'react';
import type { Theme } from '../types';
import { api } from '../services/api';

const THEME_KEY = 'ccui-theme';

export function useTheme(): Theme {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark' | 'system'>(() => {
    // Check localStorage first
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  });

  const getSystemTheme = () => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    return colorScheme === 'system' ? getSystemTheme() : colorScheme;
  });

  useEffect(() => {
    api.getPreferences().then(prefs => {
      setColorScheme(prefs.colorScheme);
      if (prefs.colorScheme === 'system') {
        setMode(getSystemTheme());
      } else {
        setMode(prefs.colorScheme);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem(THEME_KEY, colorScheme);
  }, [mode, colorScheme]);

  useEffect(() => {
    // Listen for system theme changes when in system mode
    if (colorScheme !== 'system') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setMode(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [colorScheme]);

  const toggle = async () => {
    // Cycle through: light -> dark -> system -> light
    let newColorScheme: 'light' | 'dark' | 'system';
    if (colorScheme === 'light') {
      newColorScheme = 'dark';
    } else if (colorScheme === 'dark') {
      newColorScheme = 'system';
    } else {
      newColorScheme = 'light';
    }
    
    setColorScheme(newColorScheme);
    if (newColorScheme === 'system') {
      setMode(getSystemTheme());
    } else {
      setMode(newColorScheme);
    }
    
    try {
      await api.updatePreferences({ colorScheme: newColorScheme });
    } catch {
      // ignore
    }
  };

  return { mode, toggle, colorScheme };
}