import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, FolderOpen, FileText, Bot, Settings } from 'lucide-react';
import { api } from '../../services/api';
import type { StartConversationRequest } from '../../types';
import styles from './NewConversation.module.css';

export function NewConversation() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<StartConversationRequest>({
    workingDirectory: process.env.NODE_ENV === 'development' ? '/tmp' : '',
    initialPrompt: '',
    model: '',
    systemPrompt: '',
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.workingDirectory || !formData.initialPrompt) {
      setError('Working directory and initial prompt are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.startConversation(formData);
      
      // Navigate to the conversation view
      navigate(`/c/${response.sessionId}`, {
        state: { streamingId: response.streamingId }
      });
    } catch (err: any) {
      setError(err.message || 'Failed to start conversation');
    } finally {
      setLoading(false);
    }
  };

  const selectDirectory = async () => {
    // In a real implementation, this would open a file picker
    // For now, we'll just show a prompt
    const dir = prompt('Enter working directory path:', formData.workingDirectory);
    if (dir) {
      setFormData(prev => ({ ...prev, workingDirectory: dir }));
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>New Conversation</h1>
        <p className={styles.subtitle}>Start a new conversation with Claude</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        <div className={styles.field}>
          <label htmlFor="workingDirectory">
            <FolderOpen size={16} />
            Working Directory
            <span className={styles.required}>*</span>
          </label>
          <div className={styles.inputGroup}>
            <input
              id="workingDirectory"
              type="text"
              value={formData.workingDirectory}
              onChange={(e) => setFormData(prev => ({ ...prev, workingDirectory: e.target.value }))}
              placeholder="/path/to/project"
              required
              disabled={loading}
            />
            <button
              type="button"
              className={styles.browseButton}
              onClick={selectDirectory}
              disabled={loading}
              title="Browse for directory"
            >
              <FolderOpen size={16} />
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="initialPrompt">
            <FileText size={16} />
            Initial Prompt
            <span className={styles.required}>*</span>
          </label>
          <textarea
            id="initialPrompt"
            value={formData.initialPrompt}
            onChange={(e) => setFormData(prev => ({ ...prev, initialPrompt: e.target.value }))}
            placeholder="What would you like Claude to help you with?"
            rows={4}
            required
            disabled={loading}
          />
        </div>

        <button
          type="button"
          className={styles.advancedToggle}
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <Settings size={16} />
          Advanced Options
        </button>

        {showAdvanced && (
          <div className={styles.advanced}>
            <div className={styles.field}>
              <label htmlFor="model">
                <Bot size={16} />
                Model
                <span className={styles.optional}>optional</span>
              </label>
              <select
                id="model"
                value={formData.model || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                disabled={loading}
              >
                <option value="">Default</option>
                <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                <option value="claude-opus-4-20250514">Claude Opus 4</option>
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="systemPrompt">
                <Settings size={16} />
                System Prompt
                <span className={styles.optional}>optional</span>
              </label>
              <textarea
                id="systemPrompt"
                value={formData.systemPrompt || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                placeholder="Override the default system prompt..."
                rows={3}
                disabled={loading}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          className={styles.submitButton}
          disabled={loading || !formData.workingDirectory || !formData.initialPrompt}
        >
          <Play size={18} />
          {loading ? 'Starting...' : 'Start Conversation'}
        </button>
      </form>
    </div>
  );
}