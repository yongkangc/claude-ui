import React from 'react';
import { parseTodos } from '../../../utils/tool-utils';
import styles from '../ToolRendering.module.css';

interface TodoToolProps {
  input: any;
  result: string;
  isError: boolean;
  isPending: boolean;
  isWrite: boolean;
}

export function TodoTool({ input, result, isError, isPending, isWrite }: TodoToolProps) {
  if (isPending) {
    return (
      <div className={styles.toolContent}>
        <div className={styles.pendingContent}>
          <span className={styles.loadingSpinner}></span>
          {isWrite ? 'Updating todos...' : 'Loading todos...'}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.toolContent}>
        <div className={styles.errorContent}>
          {result || 'Error with todos operation'}
        </div>
      </div>
    );
  }

  let todos: Array<{id: string; content: string; status: string}> = [];
  
  if (isWrite && input.todos && Array.isArray(input.todos)) {
    // For TodoWrite, use the input todos (the new state)
    todos = input.todos;
  } else if (!isWrite && result) {
    // For TodoRead, parse the result JSON
    todos = parseTodos(result);
  }

  if (todos.length === 0) {
    return (
      <div className={styles.toolContent}>
        <div className={styles.toolSummary}>
          No todos found
        </div>
      </div>
    );
  }

  return (
    <div className={styles.toolContent}>
      <div className={styles.todoList}>
        {todos.map((todo) => (
          <div key={todo.id} className={styles.todoItem}>
            <span className={styles.todoCheckbox}>
              {todo.status === 'completed' ? '✅' : '☐'}
            </span>
            <span className={`${styles.todoContent} ${
              todo.status === 'completed' ? styles.todoCompleted : ''
            }`}>
              {todo.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}