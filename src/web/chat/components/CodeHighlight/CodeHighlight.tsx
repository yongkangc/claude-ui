import React from 'react';
import { Highlight, themes, Language } from 'prism-react-renderer';
import styles from './CodeHighlight.module.css';

interface CodeHighlightProps {
  code: string;
  language: string;
  showLineNumbers?: boolean;
  className?: string;
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

export const CodeHighlight: React.FC<CodeHighlightProps> = ({
  code,
  language,
  showLineNumbers = false,
  className = '',
}) => {
  // Get the prism language, fallback to text if not found
  const prismLanguage = languageMap[language.toLowerCase()] || 'text';

  return (
    <Highlight
      theme={themes.github}
      code={code.trimEnd()}
      language={prismLanguage as Language}
    >
      {({ className: highlightClassName, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={`${styles.codeBlock} ${highlightClassName} ${className}`}
          style={{ ...style, margin: 0 }}
        >
          <code className={styles.codeContent}>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line, key: i })} className={styles.line}>
                {showLineNumbers && (
                  <span className={styles.lineNumber}>{i + 1}</span>
                )}
                <span className={styles.lineContent}>
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token, key })} />
                  ))}
                </span>
              </div>
            ))}
          </code>
        </pre>
      )}
    </Highlight>
  );
};