import React, { useEffect, useState } from 'react';
import { Settings, Bell, Shield, Mic } from 'lucide-react';
import styles from './PreferencesModal.module.css';
import { api } from '../../services/api';
import type { Preferences } from '@/types/preferences';
import type { GeminiHealthResponse } from '@/types';
import { Dialog } from '../Dialog';

interface Props {
  onClose: () => void;
}

type TabId = 'general' | 'notifications' | 'dataControls' | 'voiceInput';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: 'general', label: 'General', icon: <Settings size={18} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
  { id: 'dataControls', label: 'Data controls', icon: <Shield size={18} /> },
  { id: 'voiceInput', label: 'Voice Input', icon: <Mic size={18} /> },
];

export function PreferencesModal({ onClose }: Props) {
  const [prefs, setPrefs] = useState<Preferences>({ 
    colorScheme: 'system', 
    language: 'auto-detect'
  });
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [archiveStatus, setArchiveStatus] = useState<string>('');
  const [machineId, setMachineId] = useState<string>('');
  const [geminiHealth, setGeminiHealth] = useState<GeminiHealthResponse | null>(null);
  const [geminiHealthLoading, setGeminiHealthLoading] = useState(false);

  useEffect(() => {
    api.getPreferences().then(setPrefs).catch(() => {});
    api.getSystemStatus().then(status => setMachineId(status.machineId)).catch(() => {});
  }, []);


  const update = async (updates: Partial<Preferences>) => {
    const updated = await api.updatePreferences(updates);
    setPrefs(updated);
    if (updates.colorScheme) {
      // For system theme, we need to determine the actual theme
      if (updates.colorScheme === 'system') {
        const systemTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', systemTheme);
      } else {
        document.documentElement.setAttribute('data-theme', updates.colorScheme);
      }
    }
  };

  const handleCheckGeminiHealth = async () => {
    setGeminiHealthLoading(true);
    try {
      const health = await api.getGeminiHealth();
      setGeminiHealth(health);
    } catch (error) {
      setGeminiHealth({ status: 'unhealthy', message: 'Failed to fetch status', apiKeyValid: false });
    } finally {
      setGeminiHealthLoading(false);
    }
  };

  const handleArchiveAll = async () => {
    if (!confirm('Are you sure you want to archive all sessions? This action cannot be undone.')) {
      return;
    }
    
    try {
      setArchiveStatus('Archiving...');
      const response = await fetch('/api/conversations/archive-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      if (data.success) {
        setArchiveStatus(data.message);
        setTimeout(() => setArchiveStatus(''), 3000);
      } else {
        setArchiveStatus(`Error: ${data.error || 'Failed to archive sessions'}`);
      }
    } catch (error) {
      setArchiveStatus(`Error: ${error instanceof Error ? error.message : 'Failed to archive sessions'}`);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className={styles.tabContent}>
            <div className={styles.settingItem}>
              <div className={styles.settingLabel}>Theme</div>
              <select
                className={styles.dropdown}
                value={prefs.colorScheme}
                onChange={(e) => update({ colorScheme: e.target.value as 'light' | 'dark' | 'system' })}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>

            {/* <div className={styles.settingItem}>
              <div className={styles.settingLabel}>Language</div>
              <select
                className={styles.dropdown}
                value={prefs.language}
                onChange={(e) => update({ language: e.target.value })}
              >
                <option value="auto-detect">Auto-detect</option>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div> */}
          </div>
        );

      case 'notifications':
        return (
          <div className={styles.tabContent}>
            <div className={styles.section}>
              <div className={styles.settingItem}>
                <div className={styles.settingColumn}>
                  <div className={styles.settingLabel}>Enable Push Notifications</div>
                </div>
                <div className={styles.settingControl}>
                  <label className={styles.toggleWrapper}>
                    <input
                      type="checkbox"
                      className={styles.toggleInput}
                      checked={prefs.notifications?.enabled || false}
                      onChange={(e) => update({ 
                        notifications: { 
                          ...prefs.notifications, 
                          enabled: e.target.checked 
                        } 
                      })}
                    />
                    <span className={styles.toggleSlider}></span>
                  </label>
                </div>
              </div>
            </div>

            {/* Topic Instructions Section */}
            <div className={styles.section}>
              <div className={styles.description}>
                To receive push notifications, subscribe to the following <a href="https://ntfy.sh" target="_blank" rel="noopener noreferrer"><strong>ntfy</strong></a> topic: 
              </div>
              <div className={styles.codeBlock}>
                {machineId ? `cui-${machineId}` : 'Loading...'}
              </div>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Advanced</h3>
              <div className={styles.settingItem}>
                <div className={styles.settingColumn}>
                  <div className={styles.settingLabel}>Ntfy Server URL</div>
                </div>
                <input
                  type="url"
                  className={styles.inputText}
                  value={prefs.notifications?.ntfyUrl || ''}
                  placeholder="https://ntfy.sh"
                  onChange={(e) => update({ 
                    notifications: { 
                      ...prefs.notifications, 
                      enabled: prefs.notifications?.enabled || false,
                      ntfyUrl: e.target.value || undefined
                    } 
                  })}
                />
              </div>
            </div>

          </div>
        );

      case 'dataControls':
        return (
          <div className={styles.tabContent}>
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Session Management</h3>
              <button onClick={handleArchiveAll} className={styles.archiveButton}>
                Archive All Sessions
              </button>
              {archiveStatus && (
                <div className={`${styles.statusMessage} ${archiveStatus.startsWith('Error') ? styles.error : styles.success}`}>
                  {archiveStatus}
                </div>
              )}
            </div>
          </div>
        );

      case 'voiceInput':
        return (
          <div className={styles.tabContent}>
            <div className={styles.section}>
              <div className={styles.settingItem}>
                <div className={styles.settingLabel}>Gemini API Status</div>
                <div className={styles.settingValue}>
                  {geminiHealthLoading ? (
                    'Loading...'
                  ) : geminiHealth ? (
                    geminiHealth.status === 'healthy' ? (
                      <span style={{ color: 'var(--color-success)' }}>Success</span>
                    ) : (
                      <span style={{ color: 'var(--color-text-secondary)' }}>Error</span>
                    )
                  ) : (
                    <button 
                      onClick={handleCheckGeminiHealth}
                      style={{ 
                        background: 'transparent',
                        color: 'var(--color-text-primary)',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--color-text-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--color-text-primary)';
                      }}
                    >
                      Check Status
                    </button>
                  )}
                </div>
              </div>
            </div>

            {geminiHealth?.status === 'unhealthy' && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Enable Voice Input</h3>
              
              <div className={styles.description}>
                To enable Gemini-powered voice input, you need to configure a Google API key:
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingLabel}>1. Get a API key</div>
                <div className={styles.description}>
                  Visit <a 
                    href="https://aistudio.google.com/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                      https://aistudio.google.com/apikey
                  </a> to generate your free API key.
                </div>
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingLabel}>2. Configure API Environment Variable</div>
                
                <div style={{ marginTop: '12px' }}>
                  <div className={styles.codeBlock}>
                    export GOOGLE_API_KEY="your-api-key"
                  </div>
                </div>

              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingLabel}>Or Edit ~/.cui/config.json</div>
                
                <div style={{ marginTop: '12px' }}>
                  <div className={styles.codeBlock}>
                    {`{ "gemini": { "apiKey": "your-api-key" } }`}
                  </div>
                </div>
              </div>
            </div>
            )}

            <div className={styles.settingItem} style={{ fontStyle: 'italic', marginTop: '12px' }}>
              i. When using Gemini voice input, your audio data will be sent to Google for processing. Free Tier API Key allows Google to train on your data. <br></br>
              ii. On iOS Safari, you need HTTPS to use voice input.
            </div>
          </div>
        );

      default:
        return (
          <div className={styles.tabContent}>
            <div className={styles.comingSoon}>
              {tabs.find(tab => tab.id === activeTab)?.label} settings coming soon...
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={true} onClose={onClose} title="">
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">
            ✕
          </button>
        </header>
        
        <div className={styles.content}>
          <div className={styles.sidebar}>
            <div className={styles.sidebarTabs}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ''}`}
                >
                  <span className={styles.tabIcon}>{tab.icon}</span>
                  <span className={styles.tabLabel}>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
          
          <div className={styles.mainContent}>
            {renderTabContent()}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
