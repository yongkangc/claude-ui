import React from 'react';
import ReactDiffViewer from 'react-diff-viewer';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';

interface DiffViewerProps {
  oldValue: string;
  newValue: string;
  language?: string;
}

export function DiffViewer({ oldValue, newValue, language = 'javascript' }: DiffViewerProps) {
  // 渲染带语法高亮的内容
  const renderContent = (source: string): JSX.Element => {
    if (!source.trim()) {
      return <span>{source}</span>;
    }

    try {
      const grammar = Prism.languages[language] || Prism.languages.text;
      const highlighted = Prism.highlight(source, grammar, language);
      
      return (
        <span
          dangerouslySetInnerHTML={{ __html: highlighted }}
          style={{ display: 'inline' }}
        />
      );
    } catch (error) {
      // 如果高亮失败，返回原始文本
      return <span>{source}</span>;
    }
  };
  return (
    <ReactDiffViewer
      oldValue={oldValue}
      newValue={newValue}
      splitView={false}  // 统一视图
      useDarkTheme={true}
      hideLineNumbers={false}
      disableWordDiff={true}  // 禁用字符级别差异，使用行级别差异
      renderContent={renderContent}
      styles={{
        variables: {
          dark: {
            diffViewerBackground: '#292a30',
            addedBackground: 'rgba(103, 183, 164, 0.2)',
            addedColor: '#67b7a4',
            removedBackground: 'rgba(252, 106, 93, 0.2)',
            removedColor: '#fc6a5d',
            wordAddedBackground: 'rgba(103, 183, 164, 0.4)',
            wordRemovedBackground: 'rgba(252, 106, 93, 0.4)',
            addedGutterBackground: 'rgba(103, 183, 164, 0.3)',
            removedGutterBackground: 'rgba(252, 106, 93, 0.3)',
            gutterBackground: '#292a30',
            gutterBackgroundDark: '#292a30',
            highlightBackground: 'rgba(255, 255, 255, 0.1)',
            highlightGutterBackground: 'rgba(255, 255, 255, 0.2)',
            codeFoldGutterBackground: '#292a30',
            codeFoldBackground: '#292a30',
            emptyLineBackground: '#292a30',
            gutterColor: '#6c7986',
            addedGutterColor: '#67b7a4',
            removedGutterColor: '#fc6a5d',
            codeFoldContentColor: '#ffffff',
            diffViewerTitleBackground: '#1f2024',
            diffViewerTitleColor: '#ffffff',
            diffViewerTitleBorderColor: '#3a3b40',
          }
        },
        diffContainer: {
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          border: '1px solid #3a3b40',
        },
        line: {
          '& pre': {
            color: '#ffffff',
          },
          // Prism 语法高亮样式
          '& .token.comment': {
            color: '#6c7986',
            fontStyle: 'italic',
          },
          '& .token.prolog': {
            color: '#6c7986',
          },
          '& .token.doctype': {
            color: '#6c7986',
          },
          '& .token.cdata': {
            color: '#6c7986',
          },
          '& .token.punctuation': {
            color: '#ffffff',
          },
          '& .token.property': {
            color: '#d0a8ff',
          },
          '& .token.tag': {
            color: '#d0a8ff',
          },
          '& .token.boolean': {
            color: '#d0a8ff',
          },
          '& .token.number': {
            color: '#d0a8ff',
          },
          '& .token.constant': {
            color: '#d0a8ff',
          },
          '& .token.symbol': {
            color: '#d0a8ff',
          },
          '& .token.deleted': {
            color: '#fc6a5d',
          },
          '& .token.selector': {
            color: '#fc6a5d',
          },
          '& .token.attr-name': {
            color: '#fc6a5d',
          },
          '& .token.string': {
            color: '#fc6a5d',
          },
          '& .token.char': {
            color: '#fc6a5d',
          },
          '& .token.builtin': {
            color: '#fc6a5d',
          },
          '& .token.inserted': {
            color: '#67b7a4',
          },
          '& .token.operator': {
            color: '#ffffff',
          },
          '& .token.entity': {
            color: '#ffffff',
          },
          '& .token.url': {
            color: '#fc6a5d',
          },
          '& .token.atrule': {
            color: '#fc5fa3',
          },
          '& .token.attr-value': {
            color: '#fc5fa3',
          },
          '& .token.keyword': {
            color: '#fc5fa3',
            fontWeight: 'bold',
          },
          '& .token.function': {
            color: '#67b7a4',
          },
          '& .token.class-name': {
            color: '#67b7a4',
          },
          '& .token.regex': {
            color: '#a167e6',
          },
          '& .token.important': {
            color: '#a167e6',
          },
          '& .token.variable': {
            color: '#a167e6',
          },
        }
      }}
    />
  );
}