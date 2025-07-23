import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskItem } from '@/web/chat/components/Home/TaskItem';

describe('TaskItem', () => {
  const mockProps = {
    id: 'test-session-id',
    title: 'Test Task',
    timestamp: new Date().toISOString(),
    projectPath: '/test/project',
    recentDirectories: {
      '/test/project': {
        lastDate: new Date().toISOString(),
        shortname: 'project'
      }
    },
    status: 'completed' as const,
    onClick: jest.fn(),
    onCancel: jest.fn(),
    onArchive: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show archive button on hover for completed tasks', () => {
    render(<TaskItem {...mockProps} />);
    
    const container = screen.getByRole('link').parentElement;
    
    // Archive button should not be visible initially
    expect(screen.queryByLabelText('Archive task')).not.toBeInTheDocument();
    
    // Hover over the task item
    fireEvent.mouseEnter(container!);
    
    // Archive button should now be visible
    const archiveButton = screen.getByLabelText('Archive task');
    expect(archiveButton).toBeInTheDocument();
    
    // Mouse leave should hide the button
    fireEvent.mouseLeave(container!);
    expect(screen.queryByLabelText('Archive task')).not.toBeInTheDocument();
  });

  it('should call onArchive when archive button is clicked', () => {
    render(<TaskItem {...mockProps} />);
    
    const container = screen.getByRole('link').parentElement;
    fireEvent.mouseEnter(container!);
    
    const archiveButton = screen.getByLabelText('Archive task');
    fireEvent.click(archiveButton);
    
    expect(mockProps.onArchive).toHaveBeenCalledTimes(1);
    expect(mockProps.onClick).not.toHaveBeenCalled();
  });

  it('should not show archive button for ongoing tasks', () => {
    render(<TaskItem {...mockProps} status="ongoing" />);
    
    const container = screen.getByRole('link').parentElement;
    fireEvent.mouseEnter(container!);
    
    // Should not show archive button for ongoing tasks
    expect(screen.queryByLabelText('Archive task')).not.toBeInTheDocument();
    
    // Should show stop button instead
    expect(screen.getByLabelText('Stop task')).toBeInTheDocument();
  });

  it('should not show archive button for error tasks', () => {
    render(<TaskItem {...mockProps} status="error" />);
    
    const container = screen.getByRole('link').parentElement;
    fireEvent.mouseEnter(container!);
    
    // Should not show archive button for error tasks
    expect(screen.queryByLabelText('Archive task')).not.toBeInTheDocument();
  });
});