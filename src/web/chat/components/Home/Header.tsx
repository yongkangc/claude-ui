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
                <svg width="19" height="19" viewBox="4.5 5.2 11.7 13.3" fill="currentColor">
                  <circle cx="10.3613" cy="6.44531" r="1.03516" />
                  <circle cx="5.69336" cy="9.15039" r="1.03516" />
                  <circle cx="15.0195" cy="9.15039" r="1.03516" />
                  <circle cx="5.69336" cy="14.5801" r="1.03516" />
                  <circle cx="15.0195" cy="14.5801" r="1.03516" />
                  <circle cx="10.3613" cy="17.2754" r="1.03516" />
                  <path d="M10.3613 13.4961C11.2695 13.4961 11.9922 12.7734 11.9922 11.8652C11.9922 10.9668 11.25 10.2344 10.3613 10.2344C9.47266 10.2344 8.73047 10.9766 8.73047 11.8652C8.73047 12.7539 9.46289 13.4961 10.3613 13.4961Z" />
                </svg>
              </div>
              <span className={styles.logoText}>cui</span>
            </a>
          </div>

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