import React, { useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const theme = useTheme();

  useEffect(() => {
    // Handle visual viewport changes on iOS Safari
    const updateViewportHeight = () => {
      // Use visualViewport API if available (Safari 13+)
      if (window.visualViewport) {
        const vh = window.visualViewport.height;
        // Update CSS custom property for use in styles
        document.documentElement.style.setProperty('--actual-vh', `${vh}px`);
      } else {
        // Fallback for older browsers
        const vh = window.innerHeight;
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

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}