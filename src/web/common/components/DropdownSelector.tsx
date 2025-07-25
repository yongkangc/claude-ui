import React, { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import styles from './DropdownSelector.module.css';
import { useDropdownPosition } from '../hooks/useDropdownPosition';

export interface DropdownOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
  description?: string;
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
  initialFocusedIndex?: number;
  onFocusReturn?: () => void;
  visualFocusOnly?: boolean;
  triggerElementRef?: React.RefObject<HTMLElement>;
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
      initialFocusedIndex,
      onFocusReturn,
      visualFocusOnly = false,
      triggerElementRef,
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
      // Use external trigger element if provided, otherwise use container
      triggerRef.current = triggerElementRef?.current || node;
      if (ref) {
        if (typeof ref === 'function') {
          ref(node);
        } else {
          ref.current = node;
        }
      }
    }, [ref, triggerRef, triggerElementRef]);

    // Get filter text from external ref or internal state
    const getFilterText = useCallback(() => {
      if (filterTextRef?.current) {
        return filterTextRef.current.value;
      }
      return filterText;
    }, [filterText, filterTextRef]);

    // Fuzzy match function (fzf-style)
    const fuzzyMatch = (text: string, pattern: string): boolean => {
      const textLower = text.toLowerCase();
      const patternLower = pattern.toLowerCase();
      let patternIndex = 0;
      
      for (let i = 0; i < textLower.length && patternIndex < patternLower.length; i++) {
        if (textLower[i] === patternLower[patternIndex]) {
          patternIndex++;
        }
      }
      
      return patternIndex === patternLower.length;
    };

    // Default filter predicate with fuzzy matching
    const defaultFilterPredicate = useCallback((option: DropdownOption<T>, searchText: string) => {
      // If search text is empty, show all options
      if (!searchText.trim()) return true;
      
      // First try exact substring match (case-insensitive)
      if (option.label.toLowerCase().includes(searchText.toLowerCase())) {
        return true;
      }
      
      // Then try fuzzy match
      return fuzzyMatch(option.label, searchText);
    }, []);

    // Calculate match score for ranking (lower is better)
    const calculateMatchScore = (text: string, pattern: string): number => {
      const textLower = text.toLowerCase();
      const patternLower = pattern.toLowerCase();
      
      // Exact match gets highest priority
      if (textLower === patternLower) return -1000;
      
      // Substring match gets second priority
      const substringIndex = textLower.indexOf(patternLower);
      if (substringIndex !== -1) {
        // Earlier matches are better
        return substringIndex;
      }
      
      // Fuzzy match - calculate based on character distances
      let score = 1000;
      let patternIndex = 0;
      let lastMatchIndex = -1;
      
      for (let i = 0; i < textLower.length && patternIndex < patternLower.length; i++) {
        if (textLower[i] === patternLower[patternIndex]) {
          // Add distance from last match (closer consecutive matches are better)
          if (lastMatchIndex !== -1) {
            score += (i - lastMatchIndex - 1) * 10;
          }
          lastMatchIndex = i;
          patternIndex++;
        }
      }
      
      // If not all pattern characters were found, return worst score
      if (patternIndex !== patternLower.length) {
        return Infinity;
      }
      
      return score;
    };

    // Filter and sort options
    const filteredOptions = (() => {
      const searchText = getFilterText();
      if (!searchText.trim()) return options;
      
      const predicate = filterPredicate || defaultFilterPredicate;
      
      // Filter options
      const filtered = options.filter(option => predicate(option, searchText));
      
      // Sort by match score if using default predicate
      if (!filterPredicate) {
        return filtered.sort((a, b) => {
          const scoreA = calculateMatchScore(a.label, searchText);
          const scoreB = calculateMatchScore(b.label, searchText);
          return scoreA - scoreB;
        });
      }
      
      return filtered;
    })();

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
      if (isOpen && showFilterInput && filterInputRef.current && !visualFocusOnly) {
        filterInputRef.current.focus();
      }
    }, [isOpen, showFilterInput, visualFocusOnly]);

    useEffect(() => {
      // Only take actual DOM focus if visualFocusOnly is false
      if (!visualFocusOnly) {
        if (focusedIndex >= 0 && focusedIndex < optionRefs.current.length) {
          optionRefs.current[focusedIndex]?.focus();
        } else if (focusedIndex === -1 && showFilterInput && filterInputRef.current) {
          filterInputRef.current.focus();
        }
      }
    }, [focusedIndex, showFilterInput, visualFocusOnly]);

    // Reset focused index when dropdown closes or filter changes
    useEffect(() => {
      if (!isOpen) {
        setFocusedIndex(-1);
        setFilterText('');
      } else if (isOpen && initialFocusedIndex !== undefined) {
        // Set initial focused index when dropdown opens
        setFocusedIndex(initialFocusedIndex);
      }
    }, [isOpen, initialFocusedIndex]);

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
          if (focusedIndex > 0) {
            setFocusedIndex(focusedIndex - 1);
          } else if (focusedIndex === 0 && !showFilterInput && onFocusReturn) {
            // Return focus to parent when at first item with no filter input
            onFocusReturn();
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