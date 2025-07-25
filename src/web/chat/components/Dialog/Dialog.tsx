import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Dialog({ open, onClose, title, children }: DialogProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const isDragging = useRef<boolean>(false);

  // Check if mobile on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle open/close animations
  useEffect(() => {
    if (open) {
      // First render the portal
      setIsVisible(true);
      // Then trigger animation
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    } else {
      // Start close animation
      setIsAnimating(false);
      // Remove from DOM after animation
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 250); // Match transition duration
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Handle ESC key
  useEffect(() => {
    if (!open) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Mobile swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || !dialogRef.current) return;
    
    currentY.current = e.touches[0].clientY;
    const deltaY = currentY.current - startY.current;
    
    // Only allow dragging down
    if (deltaY > 0) {
      dialogRef.current.style.transform = `translateY(${deltaY}px)`;
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging.current || !dialogRef.current) return;
    
    const deltaY = currentY.current - startY.current;
    
    // If dragged more than 100px down, close the dialog
    if (deltaY > 100) {
      onClose();
    } else {
      // Snap back to position
      dialogRef.current.style.transform = '';
    }
    
    isDragging.current = false;
  };

  if (!isVisible) return null;

  const dialogContent = (
    <div
      className={`${styles.backdrop} ${isAnimating ? styles.open : ''}`}
      onClick={handleBackdropClick}
      data-mobile={isMobile}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-labelledby={title ? 'dialog-title' : undefined}
        aria-modal="true"
        className={`${styles.dialog} ${isMobile ? styles.mobile : styles.desktop}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isMobile && (
          <div className={styles.dragHandle} />
        )}
        {title && (
          <h2 id="dialog-title" className="sr-only">{title}</h2>
        )}
        <div className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(
    dialogContent,
    document.body
  );
}