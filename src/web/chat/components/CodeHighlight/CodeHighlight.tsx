import React, { useState } from 'react';
import { Highlight, Language } from 'prism-react-renderer';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import styles from './CodeHighlight.module.css';

interface CodeHighlightProps {
  code: string;
  language: string;
  showLineNumbers?: boolean;
  className?: string;
  isExpand?: boolean;
}

// Map our language identifiers to prism-react-renderer language names
const languageMap: Record<string, Language> = {
  javascript: 'javascript',
  typescript: 'typescript',
  jsx: 'jsx',
  tsx: 'tsx',
  python: 'python',
  java: 'java',
  csharp: 'csharp',
  cpp: 'cpp',
  c: 'c',
  go: 'go',
  rust: 'rust',
  php: 'php',
  ruby: 'ruby',
  swift: 'swift',
  kotlin: 'kotlin',
  scala: 'scala',
  r: 'r',
  matlab: 'matlab',
  sql: 'sql',
  bash: 'bash',
  powershell: 'powershell',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  yaml: 'yaml',
  json: 'json',
  xml: 'xml',
  html: 'markup',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  markdown: 'markdown',
  latex: 'latex',
  vim: 'vim',
  lua: 'lua',
  perl: 'perl',
  objectivec: 'objectivec',
  fsharp: 'fsharp',
  ocaml: 'ocaml',
  haskell: 'haskell',
  elixir: 'elixir',
  erlang: 'erlang',
  clojure: 'clojure',
  lisp: 'lisp',
  scheme: 'scheme',
  fortran: 'fortran',
  pascal: 'pascal',
  dart: 'dart',
  groovy: 'groovy',
  solidity: 'solidity',
  graphql: 'graphql',
  wasm: 'wasm',
  vhdl: 'vhdl',
  verilog: 'verilog',
  asm: 'asm6502',
  diff: 'diff',
  ini: 'ini',
  toml: 'toml',
  gitignore: 'gitignore',
  text: 'text',
};

// Xcode-like themes for light and dark modes
const darkTheme = {
  plain: {
    color: '#ffffff',
    backgroundColor: '#292a30',
  },
  styles: [
    {
      types: ['comment', 'prolog', 'doctype', 'cdata'],
      style: {
        color: '#6c7986',
        fontStyle: 'italic' as const,
      },
    },
    {
      types: ['punctuation'],
      style: {
        color: '#ffffff',
      },
    },
    {
      types: ['property', 'tag', 'boolean', 'number', 'constant', 'symbol'],
      style: {
        color: '#d0a8ff',
      },
    },
    {
      types: ['deleted', 'selector', 'attr-name', 'string', 'char', 'builtin'],
      style: {
        color: '#fc6a5d',
      },
    },
    {
      types: ['inserted'],
      style: {
        color: '#67b7a4',
      },
    },
    {
      types: ['operator', 'entity', 'url'],
      style: {
        color: '#ffffff',
      },
    },
    {
      types: ['atrule', 'attr-value', 'keyword'],
      style: {
        color: '#fc5fa3',
        fontWeight: 'bold' as const,
      },
    },
    {
      types: ['function', 'class-name'],
      style: {
        color: '#67b7a4',
      },
    },
    {
      types: ['regex', 'important', 'variable'],
      style: {
        color: '#a167e6',
      },
    },
  ],
};

const lightTheme = {
  plain: {
    color: '#262626',
    backgroundColor: '#ffffff',
  },
  styles: [
    {
      types: ['comment', 'prolog', 'doctype', 'cdata'],
      style: {
        color: '#5d6c79',
        fontStyle: 'italic' as const,
      },
    },
    {
      types: ['punctuation'],
      style: {
        color: '#262626',
      },
    },
    {
      types: ['property', 'tag', 'boolean', 'number', 'constant', 'symbol'],
      style: {
        color: '#aa0d91',
      },
    },
    {
      types: ['deleted', 'selector', 'attr-name', 'string', 'char', 'builtin'],
      style: {
        color: '#c41a16',
      },
    },
    {
      types: ['inserted'],
      style: {
        color: '#1c00cf',
      },
    },
    {
      types: ['operator', 'entity', 'url'],
      style: {
        color: '#262626',
      },
    },
    {
      types: ['atrule', 'attr-value', 'keyword'],
      style: {
        color: '#aa0d91',
        fontWeight: 'bold' as const,
      },
    },
    {
      types: ['function', 'class-name'],
      style: {
        color: '#1c00cf',
      },
    },
    {
      types: ['regex', 'important', 'variable'],
      style: {
        color: '#5c2699',
      },
    },
  ],
};

export const CodeHighlight: React.FC<CodeHighlightProps> = ({
  code,
  language,
  showLineNumbers = false,
  className = '',
  isExpand = false,
}) => {
  const theme = useTheme();
  const currentTheme = theme.mode === 'dark' ? darkTheme : lightTheme;
  const [isExpanded, setIsExpanded] = useState(isExpand);
  
  // Get the prism language, fallback to text if not found
  const prismLanguage = languageMap[language.toLowerCase()] || 'text';

  return (
    <Highlight
      theme={currentTheme}
      code={code.trimEnd()}
      language={prismLanguage as Language}
    >
      {({ className: highlightClassName, style, tokens, getLineProps, getTokenProps }) => {
        const totalLines = tokens.length;
        const shouldShowExpandButton = totalLines > 8;
        const linesToShow = isExpanded ? tokens : tokens.slice(0, 8);
        
        return (
          <div className={styles.codeContainer}>
            {shouldShowExpandButton && (
              <button
                className={styles.expandButton}
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "Show fewer lines" : "Show all lines"}
              >
                {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            )}
            <pre
              className={`${styles.codeBlock} ${highlightClassName} ${className}`}
              style={{ ...style, margin: 0 }}
            >
              <code className={styles.codeContent}>
                {linesToShow.map((line, i) => {
                  const { key, ...lineProps } = getLineProps({ line, key: i });
                  return (
                    <div key={i} {...lineProps} className={styles.line}>
                      {showLineNumbers && (
                        <span className={styles.lineNumber}>{i + 1}</span>
                      )}
                      <span className={styles.lineContent}>
                        {line.map((token, key) => {
                          const { key: tokenKey, ...tokenProps } = getTokenProps({ token, key });
                          return (
                            <span key={key} {...tokenProps} />
                          );
                        })}
                      </span>
                    </div>
                  );
                })}
                {!isExpanded && shouldShowExpandButton && (
                  <div className={styles.line}>
                    <span className={styles.lineContent}>
                      <span className={styles.ellipsis}>...</span>
                    </span>
                  </div>
                )}
              </code>
            </pre>
          </div>
        );
      }}
    </Highlight>
  );
};