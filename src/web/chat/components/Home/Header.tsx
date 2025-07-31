import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { PreferencesModal } from '../PreferencesModal/PreferencesModal';
import styles from './Header.module.css';

export function Header() {
  const theme = useTheme();
  const [showPrefs, setShowPrefs] = useState(false);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.innerHeader}>
          {/* Navigation */}
          <nav className={styles.navMenu}>
            {/* Settings Button */}
            <button className={styles.settingButton} aria-label="Open Settings" onClick={() => setShowPrefs(true)}>
              <Settings size={18} />
            </button>
          </nav>
        </div>
      </header>
      {showPrefs && <PreferencesModal onClose={() => setShowPrefs(false)} />}
    </>
  );
}