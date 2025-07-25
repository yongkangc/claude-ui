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
          {/* Logo */}
          <div className={styles.logo}>
            <a href="/" className={styles.logoLink}>
              <div className={styles.logoIcon}>
                <svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </div>
              <span className={styles.logoText}>cui</span>
            </a>
          </div>

          {/* Navigation */}
          <nav className={styles.navMenu}>
            <div className={styles.navItems}>
              <a href="#" className={styles.navLink}>
                Environments
              </a>
              <a href="#" className={styles.navLink} target="_blank" rel="noopener">
                Docs
              </a>
            </div>

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