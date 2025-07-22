# React Diff Viewer Integration Guide for CCUI

## 现状分析

CCUI 项目当前使用:
- **prism-react-renderer** (v2.4.1) 进行语法高亮
- 自定义的 diff 渲染实现在 `EditTool.tsx`
- 已有 `prismjs` 依赖但未使用

## 推荐方案: 使用 react-diff-viewer

### 1. 安装依赖

```bash
npm install react-diff-viewer
```

### 2. 与 prism-react-renderer 集成

由于项目使用 `prism-react-renderer` 而非原生 `prismjs`，需要创建适配器:

```typescript
// src/web/chat/components/ToolRendering/tools/EnhancedEditTool.tsx
import React from 'react';
import ReactDiffViewer from 'react-diff-viewer';
import { Highlight, themes } from 'prism-react-renderer';
import { getLanguageFromFilename } from '@/web/chat/utils/language-detection';

interface EnhancedEditToolProps {
  oldString: string;
  newString: string;
  filePath: string;
}

const EnhancedEditTool: React.FC<EnhancedEditToolProps> = ({
  oldString,
  newString,
  filePath
}) => {
  // 从文件路径检测语言
  const language = getLanguageFromFilename(filePath) || 'text';

  // 创建 renderContent 函数来集成 prism-react-renderer
  const highlightSyntax = (codeString: string) => (
    <Highlight
      theme={themes.github}
      code={codeString}
      language={language}
    >
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <span className={className} style={style}>
          {tokens.map((line, i) => (
            <span key={i} {...getLineProps({ line, key: i })}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token, key })} />
              ))}
            </span>
          ))}
        </span>
      )}
    </Highlight>
  );

  return (
    <ReactDiffViewer
      oldValue={oldString}
      newValue={newString}
      splitView={false}  // 使用统一视图，类似 GitHub
      renderContent={highlightSyntax}
      useDarkTheme={false}
      styles={{
        variables: {
          light: {
            codeFoldGutterBackground: '#f6f8fa',
            codeFoldBackground: '#fafbfc',
            diffViewerBackground: '#fff',
            diffViewerColor: '#24292e',
            addedBackground: '#e6ffed',
            addedColor: '#24292e',
            removedBackground: '#ffeef0',
            removedColor: '#24292e',
            wordAddedBackground: '#acf2bd',
            wordRemovedBackground: '#fdb8c0',
            addedLineBackground: '#e6ffed',
            removedLineBackground: '#ffeef0',
          }
        },
        diffContainer: {
          fontSize: '14px',
          fontFamily: 'Monaco, Consolas, "Courier New", monospace',
        }
      }}
    />
  );
};

export default EnhancedEditTool;
```

### 3. 替代方案: 使用原生 prismjs

如果想直接使用已安装的 `prismjs`:

```typescript
import React from 'react';
import ReactDiffViewer from 'react-diff-viewer';
import Prism from 'prismjs';
import 'prismjs/themes/prism.css'; // 或使用其他主题

const EditToolWithPrism: React.FC<EditToolProps> = ({
  oldString,
  newString,
  filePath
}) => {
  const language = getLanguageFromFilename(filePath) || 'javascript';
  
  const highlightSyntax = (str: string) => (
    <pre
      style={{ display: 'inline', margin: 0 }}
      dangerouslySetInnerHTML={{
        __html: Prism.highlight(
          str, 
          Prism.languages[language] || Prism.languages.plaintext,
          language
        ),
      }}
    />
  );

  return (
    <ReactDiffViewer
      oldValue={oldString}
      newValue={newString}
      splitView={false}
      renderContent={highlightSyntax}
    />
  );
};
```

### 4. 集成到现有的 EditTool

修改 `src/web/chat/components/ToolRendering/tools/EditTool.tsx`:

```typescript
import EnhancedEditTool from './EnhancedEditTool';

// 在组件中使用
{showDiff && (
  <EnhancedEditTool
    oldString={oldString}
    newString={newString}
    filePath={filePath}
  />
)}
```

## 优势对比

### react-diff-viewer 的优势:
1. **内置 UI 组件**: 提供完整的 diff 视图，包括行号、折叠等功能
2. **主题支持**: 内置亮色/暗色主题，可自定义
3. **分割/统一视图**: 支持 GitHub 风格的 diff 显示
4. **字符级差异**: 高亮显示具体的字符变化
5. **性能优化**: 对大文件有优化处理

### 现有实现的局限:
1. 简单的行级差异显示
2. 无语法高亮
3. 无字符级差异标记
4. UI 功能较少

## 其他可选库

### react-diff-view
- 更灵活的 API
- 需要更多配置
- 适合高度定制的场景

### react-diff
- 最简单的实现
- 适合纯文本差异
- 不支持语法高亮

## 建议

1. **使用 react-diff-viewer** 配合现有的 prism-react-renderer
2. 保持与项目现有风格一致（Xcode-like 主题）
3. 使用统一视图模式，符合 Claude 的输出风格
4. 考虑性能，对大文件使用虚拟滚动

## 实施步骤

1. 安装 react-diff-viewer
2. 创建 EnhancedEditTool 组件
3. 集成语法高亮（使用现有的 prism-react-renderer）
4. 更新样式以匹配项目主题
5. 测试不同语言和文件类型
6. 优化性能（如需要）