import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import styles from './JsonViewer.module.css';

interface JsonViewerProps {
  data: any;
  collapsed?: boolean;
  depth?: number;
}

export function JsonViewer({ data, collapsed = false, depth = 0 }: JsonViewerProps) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const renderValue = (value: any, key?: string): React.ReactNode => {
    if (value === null) {
      return <span className={styles.null}>null</span>;
    }

    if (value === undefined) {
      return <span className={styles.undefined}>undefined</span>;
    }

    if (typeof value === 'boolean') {
      return <span className={styles.boolean}>{value.toString()}</span>;
    }

    if (typeof value === 'number') {
      return <span className={styles.number}>{value}</span>;
    }

    if (typeof value === 'string') {
      return <span className={styles.string}>"{value}"</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className={styles.bracket}>[]</span>;
      }

      return (
        <span className={styles.array}>
          <button
            className={styles.toggle}
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
          <span className={styles.bracket}>[</span>
          {isCollapsed ? (
            <span className={styles.collapsed}>...{value.length} items</span>
          ) : (
            <div className={styles.content}>
              {value.map((item, index) => (
                <div key={index} className={styles.item}>
                  <span className={styles.index}>{index}:</span>
                  {renderValue(item)}
                  {index < value.length - 1 && <span className={styles.comma}>,</span>}
                </div>
              ))}
            </div>
          )}
          <span className={styles.bracket}>]</span>
        </span>
      );
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return <span className={styles.bracket}>{'{}'}</span>;
      }

      return (
        <span className={styles.object}>
          <button
            className={styles.toggle}
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
          <span className={styles.bracket}>{'{'}</span>
          {isCollapsed ? (
            <span className={styles.collapsed}>...{entries.length} properties</span>
          ) : (
            <div className={styles.content}>
              {entries.map(([k, v], index) => (
                <div key={k} className={styles.item}>
                  <span className={styles.property}>"{k}"</span>
                  <span className={styles.colon}>:</span>
                  {renderValue(v, k)}
                  {index < entries.length - 1 && <span className={styles.comma}>,</span>}
                </div>
              ))}
            </div>
          )}
          <span className={styles.bracket}>{'}'}</span>
        </span>
      );
    }

    return <span className={styles.unknown}>{String(value)}</span>;
  };

  return (
    <div className={styles.container}>
      {depth === 0 && (
        <button
          className={styles.copyButton}
          onClick={handleCopy}
          title="Copy JSON"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      )}
      {renderValue(data)}
    </div>
  );
}