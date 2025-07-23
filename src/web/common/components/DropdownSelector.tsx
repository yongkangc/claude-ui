import React, { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import styles from './DropdownSelector.module.css';
import { useDropdownPosition } from '../hooks/useDropdownPosition';

export interface DropdownOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface DropdownSelectorProps<T = string> {
  options: DropdownOption<T>[];
  value?: T;
  onChange: (value: T) => void;
  placeholder?: string;
  showFilterInput?: boolean;
  filterTextRef?: React.RefObject<HTMLInputElement>;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  renderOption?: (option: DropdownOption<T>) => React.ReactNode;
  className?: string;
  dropdownClassName?: string;
  maxHeight?: number;
  position?: 'absolute' | 'fixed';
  filterPredicate?: (option: DropdownOption<T>, searchText: string) => boolean;
  renderTrigger?: (props: { isOpen: boolean; value?: T; onClick: () => void }) => React.ReactNode;
  customFilterInput?: React.ReactNode;
  maxVisibleItems?: number;
}

export const DropdownSelector = forwardRef<HTMLDivElement, DropdownSelectorProps<any>>(
  function DropdownSelector<T = string>(
    {
      options,
      value,
      onChange,
      placeholder = 'Select an option',
      showFilterInput = true,
      filterTextRef,
      isOpen: controlledIsOpen,
      onOpenChange,
      renderOption,
      className,
      dropdownClassName,
      maxHeight = 360,
      position = 'absolute',
      filterPredicate,
      renderTrigger,
      customFilterInput,
      maxVisibleItems = 5,
    }: DropdownSelectorProps<T>,
    ref: React.ForwardedRef<HTMLDivElement>
  ) {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const [filterText, setFilterText] = useState('');
    const [focusedIndex, setFocusedIndex] = useState(-1);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const filterInputRef = useRef<HTMLInputElement>(null);
    const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

    // Use controlled open state if provided
    const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
    const setIsOpen = useCallback((open: boolean) => {
      if (controlledIsOpen === undefined) {
        setInternalIsOpen(open);
      }
      onOpenChange?.(open);
    }, [controlledIsOpen, onOpenChange]);

    // Use dropdown positioning hook
    const { triggerRef, dropdownRef, position: dropdownPosition } = useDropdownPosition({
      isOpen,
      maxHeight,
    });

    // Combine refs
    const combinedContainerRef = useCallback((node: HTMLDivElement | null) => {
      containerRef.current = node;
      triggerRef.current = node;
      if (ref) {
        if (typeof ref === 'function') {
          ref(node);
        } else {
          ref.current = node;
        }
      }
    }, [ref, triggerRef]);

    // Get filter text from external ref or internal state
    const getFilterText = useCallback(() => {
      if (filterTextRef?.current) {
        return filterTextRef.current.value;
      }
      return filterText;
    }, [filterText, filterTextRef]);

    // Default filter predicate
    const defaultFilterPredicate = useCallback((option: DropdownOption<T>, searchText: string) => {
      return option.label.toLowerCase().includes(searchText.toLowerCase());
    }, []);

    // Filter options
    const filteredOptions = options.filter(option => {
      const searchText = getFilterText();
      if (!searchText.trim()) return true;
      
      const predicate = filterPredicate || defaultFilterPredicate;
      return predicate(option, searchText);
    });

    // Limit visible options based on maxVisibleItems
    const visibleOptions = (() => {
      // If maxVisibleItems is -1, show all options
      if (maxVisibleItems === -1) {
        return filteredOptions;
      }
      // Otherwise, limit to maxVisibleItems
      return filteredOptions.slice(0, maxVisibleItems);
    })();

    // Handle click outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        if (
          containerRef.current && 
          !containerRef.current.contains(target) &&
          dropdownRef.current &&
          !dropdownRef.current.contains(target)
        ) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isOpen, setIsOpen]);

    // Focus management
    useEffect(() => {
      if (isOpen && showFilterInput && filterInputRef.current) {
        filterInputRef.current.focus();
      }
    }, [isOpen, showFilterInput]);

    useEffect(() => {
      if (focusedIndex >= 0 && focusedIndex < optionRefs.current.length) {
        optionRefs.current[focusedIndex]?.focus();
      } else if (focusedIndex === -1 && showFilterInput && filterInputRef.current) {
        filterInputRef.current.focus();
      }
    }, [focusedIndex, showFilterInput]);

    // Reset focused index when dropdown closes or filter changes
    useEffect(() => {
      if (!isOpen) {
        setFocusedIndex(-1);
        setFilterText('');
      }
    }, [isOpen]);

    useEffect(() => {
      setFocusedIndex(-1);
    }, [filterText, filterTextRef]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (focusedIndex < visibleOptions.length - 1) {
            setFocusedIndex(focusedIndex + 1);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (focusedIndex > -1) {
            setFocusedIndex(focusedIndex - 1);
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < visibleOptions.length) {
            const option = visibleOptions[focusedIndex];
            if (!option.disabled) {
              onChange(option.value);
              setIsOpen(false);
            }
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
        case 'p':
          if (e.ctrlKey) {
            e.preventDefault();
            if (focusedIndex > -1) {
              setFocusedIndex(focusedIndex - 1);
            }
          }
          break;
        case 'n':
          if (e.ctrlKey) {
            e.preventDefault();
            if (focusedIndex < visibleOptions.length - 1) {
              setFocusedIndex(focusedIndex + 1);
            }
          }
          break;
      }
    };

    const handleOptionClick = (option: DropdownOption<T>) => {
      if (!option.disabled) {
        onChange(option.value);
        setIsOpen(false);
      }
    };

    const selectedOption = options.find(opt => opt.value === value);

    return (
      <>
        {renderTrigger ? (
          <div ref={combinedContainerRef} className={className}>
            {renderTrigger({
              isOpen,
              value,
              onClick: () => setIsOpen(!isOpen)
            })}
          </div>
        ) : (
          <div 
            ref={combinedContainerRef} 
            className={`${styles.container} ${className || ''}`}
          >
            {/* Children can be the trigger element */}
          </div>
        )}

        {isOpen && createPortal(
          <div 
            ref={dropdownRef}
            className={`${styles.dropdown} ${dropdownClassName || ''}`}
            style={{
              position: 'fixed',
              ...dropdownPosition,
              zIndex: 9999,
            }}
            onKeyDown={handleKeyDown}
          >
            {/* Filter input section */}
            {customFilterInput ? (
              <>
                {customFilterInput}
                <div className={styles.divider} />
              </>
            ) : (
              showFilterInput && !filterTextRef && (
                <>
                  <div className={styles.inputSection}>
                    <input
                      ref={filterInputRef}
                      type="text"
                      className={styles.filterInput}
                      placeholder={placeholder}
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      aria-label="Filter options"
                    />
                  </div>
                  <div className={styles.divider} />
                </>
              )
            )}

            {/* Options list */}
            <div className={styles.optionsList}>
              {visibleOptions.length === 0 ? (
                <div className={styles.noOptions}>No options found</div>
              ) : (
                visibleOptions.map((option, index) => (
                  <button
                    key={String(option.value)}
                    ref={(el) => { optionRefs.current[index] = el; }}
                    type="button"
                    className={`${styles.optionItem} ${
                      value === option.value ? styles.selected : ''
                    } ${focusedIndex === index ? styles.focused : ''} ${
                      option.disabled ? styles.disabled : ''
                    }`}
                    onClick={() => handleOptionClick(option)}
                    disabled={option.disabled}
                    tabIndex={-1}
                  >
                    <div className={styles.optionContent}>
                      {renderOption ? renderOption(option) : (
                        <span className={styles.optionText}>{option.label}</span>
                      )}
                    </div>
                    {value === option.value && (
                      <div className={styles.checkmark}>
                        <Check size={16} />
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }
);