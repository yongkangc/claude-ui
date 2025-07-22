# EditTool 替换计划 - 使用 React Diff Viewer

## 现状
- EditTool 使用简单的 `formatDiffLines` 函数
- 所有旧内容显示为删除行 (-)
- 所有新内容显示为添加行 (+)
- 无智能 diff 算法，无语法高亮

## 最小化实现计划

### 步骤 1: 安装依赖
```bash
npm install react-diff-viewer
```

### 步骤 2: 创建简单的 diff 组件
创建新文件: `src/web/chat/components/ToolRendering/tools/DiffViewer.tsx`

```typescript
import React from 'react';
import ReactDiffViewer from 'react-diff-viewer';

interface DiffViewerProps {
  oldValue: string;
  newValue: string;
}

export function DiffViewer({ oldValue, newValue }: DiffViewerProps) {
  return (
    <ReactDiffViewer
      oldValue={oldValue}
      newValue={newValue}
      splitView={false}  // 统一视图
      useDarkTheme={true}
      hideLineNumbers={false}
      styles={{
        variables: {
          dark: {
            diffViewerBackground: '#1a1a1a',
            addedBackground: 'rgba(34, 197, 94, 0.2)',
            addedColor: '#86efac',
            removedBackground: 'rgba(239, 68, 68, 0.2)',
            removedColor: '#fca5a5',
          }
        }
      }}
    />
  );
}
```

### 步骤 3: 替换 EditTool 中的 diff 渲染
修改 `EditTool.tsx`:

1. 导入 DiffViewer
2. 替换第 72-91 行的单个 edit 渲染
3. 替换第 43-64 行的 multi-edit 渲染

```typescript
// 单个 edit (替换第 72-91 行)
if (input.old_string !== undefined && input.new_string !== undefined) {
  return (
    <div className={styles.toolContent}>
      <DiffViewer
        oldValue={input.old_string}
        newValue={input.new_string}
      />
    </div>
  );
}

// Multi-edit (替换第 43-64 行)
{input.edits.map((edit: any, index: number) => (
  <div key={index}>
    <DiffViewer
      oldValue={edit.old_string || ''}
      newValue={edit.new_string || ''}
    />
    {index < input.edits.length - 1 && (
      <div style={{ height: '8px' }} />
    )}
  </div>
))}
```

### 步骤 4: 删除不再需要的代码
- 删除 `formatDiffLines` 导入 (第 2 行)
- 删除相关的 CSS 类使用

## 实施要点

1. **保持简单**: 第一版不加语法高亮
2. **匹配主题**: 使用现有的颜色值
3. **统一视图**: `splitView={false}`
4. **最小改动**: 只替换 diff 渲染部分

## 预期效果

- 智能 diff 算法 (只显示真正改变的行)
- 字符级差异高亮
- 更好的视觉效果
- 保持现有的暗色主题风格

## 后续优化 (不在本次范围)

- 添加语法高亮 (使用 prism-react-renderer)
- 自定义行号样式
- 添加折叠功能
- 性能优化