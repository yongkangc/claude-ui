import React, { useState, useEffect } from 'react';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import styles from './Layout.module.css';

interface LayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export function Layout({ sidebar, children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Close sidebar when switching from mobile to desktop
    if (!isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [isMobile, sidebarOpen]);

  return (
    <div className={styles.container}>
      {/* Mobile header */}
      {isMobile && (
        <header className={styles.header}>
          <button
            className={styles.menuButton}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 className={styles.title}>CCUI</h1>
          <button
            className={styles.themeButton}
            onClick={theme.toggle}
            aria-label={`Switch to ${theme.mode === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme.mode === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </header>
      )}

      {/* Sidebar */}
      <aside
        className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''} ${
          isMobile ? styles.sidebarMobile : ''
        }`}
      >
        {!isMobile && (
          <div className={styles.sidebarHeader}>
            <h1 className={styles.title}>CCUI</h1>
            <button
              className={styles.themeButton}
              onClick={theme.toggle}
              aria-label={`Switch to ${theme.mode === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme.mode === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        )}
        <div className={styles.sidebarContent}>{sidebar}</div>
      </aside>

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          className={styles.overlay}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main content */}
      <main className={`${styles.main} ${isMobile ? styles.mainMobile : ''}`}>
        {children}
      </main>
    </div>
  );
}