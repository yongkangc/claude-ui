import React from 'react';
import { Circle, Clock, CheckCircle } from 'lucide-react';
import { parseTodos } from '../../../utils/tool-utils';
import styles from '../ToolRendering.module.css';

interface TodoToolProps {
  input: any;
  result: string;
  isError: boolean;
  isPending: boolean;
  isWrite: boolean;
}

function getTodoStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle size={16} className={styles.todoIconCompleted} />;
    case 'in_progress':
      return <Clock size={16} className={styles.todoIconInProgress} />;
    case 'pending':
    default:
      return <Circle size={16} className={styles.todoIconPending} />;
  }
}

export function TodoTool({ input, result, isError, isPending, isWrite }: TodoToolProps) {
  if (isPending) {
    return <div className={styles.toolContent} />;
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
      <div className={styles.todoListContainer}>
        <div className={styles.todoList}>
          {todos.map((todo) => (
            <div key={todo.id} className={styles.todoItem}>
              <span className={styles.todoCheckbox}>
                {getTodoStatusIcon(todo.status)}
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
    </div>
  );
}