import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const theme = useTheme();

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}