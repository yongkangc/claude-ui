import React, { useState, useEffect } from 'react';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import styles from './Layout.module.css';

interface LayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export function Layout({ sidebar, children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const theme = useTheme();
  const location = useLocation();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Handle visual viewport changes on iOS Safari
    const updateViewportHeight = () => {
      // Use visualViewport API if available (Safari 13+)
      if (window.visualViewport) {
        const vh = window.visualViewport.height;
        setViewportHeight(vh);
        // Update CSS custom property for use in styles
        document.documentElement.style.setProperty('--actual-vh', `${vh}px`);
      } else {
        // Fallback for older browsers
        const vh = window.innerHeight;
        setViewportHeight(vh);
        document.documentElement.style.setProperty('--actual-vh', `${vh}px`);
      }
    };

    // Initial update
    updateViewportHeight();

    // Listen for viewport changes
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportHeight);
      window.visualViewport.addEventListener('scroll', updateViewportHeight);
    }
    window.addEventListener('resize', updateViewportHeight);
    window.addEventListener('orientationchange', updateViewportHeight);

    // Force update after a slight delay to handle Safari's initial load
    const timeoutId = setTimeout(updateViewportHeight, 100);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewportHeight);
        window.visualViewport.removeEventListener('scroll', updateViewportHeight);
      }
      window.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('orientationchange', updateViewportHeight);
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    // Close sidebar when switching from mobile to desktop
    if (!isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [isMobile, sidebarOpen]);

  useEffect(() => {
    // Close sidebar on mobile when navigating to a new route
    if (isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    // Prevent body scrolling when sidebar is open on mobile
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
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