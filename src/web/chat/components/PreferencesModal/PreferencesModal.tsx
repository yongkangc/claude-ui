import React, { useEffect, useState } from 'react';
import { Settings, Bell, Shield } from 'lucide-react';
import styles from './PreferencesModal.module.css';
import { api } from '../../services/api';
import type { Preferences } from '@/types/preferences';
import { Dialog } from '../Dialog';

interface Props {
  onClose: () => void;
}

type TabId = 'general' | 'notifications' | 'dataControls';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: 'general', label: 'General', icon: <Settings size={18} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
  { id: 'dataControls', label: 'Data controls', icon: <Shield size={18} /> },
];

export function PreferencesModal({ onClose }: Props) {
  const [prefs, setPrefs] = useState<Preferences>({ 
    colorScheme: 'system', 
    language: 'auto-detect'
  });
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [archiveStatus, setArchiveStatus] = useState<string>('');
  const [machineId, setMachineId] = useState<string>('');

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

            <div className={styles.settingItem}>
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
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className={styles.tabContent}>
            <div className={styles.settingItem}>
              <div className={styles.settingColumn}>
                <div className={styles.settingLabel}>Enable Notifications</div>
                <div className={styles.settingDescription}>
                  Receive push notifications for conversation completions and permission requests
                </div>
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

            <div className={styles.settingItem}>
              <div className={styles.settingColumn}>
                <div className={styles.settingLabel}>Ntfy Server URL</div>
                <div className={styles.settingDescription}>
                  Custom ntfy server URL (leave empty to use default ntfy.sh)
                </div>
              </div>
              <input
                type="url"
                className={styles.dropdown}
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

            {/* Topic Instructions Section */}
            <div className={styles.sessionSection}>
              <h3 className={styles.sectionTitle}>Setup Instructions</h3>
              <div className={styles.settingDescription} style={{ marginBottom: '12px' }}>
                To receive push notifications for Claude conversations and permission requests, subscribe to your personal ntfy topic:
              </div>
              <div style={{ 
                backgroundColor: 'var(--color-bg-secondary)', 
                padding: '12px', 
                borderRadius: '8px', 
                fontFamily: 'monospace', 
                fontSize: '14px',
                border: '1px solid var(--color-border-light)',
                marginBottom: '12px'
              }}>
                {machineId ? `cui-${machineId}` : 'Loading...'}
              </div>
              <div className={styles.settingDescription}>
                New to ntfy? Visit <a href="https://docs.ntfy.sh" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>https://docs.ntfy.sh</a> to learn how to set up notifications on your devices.
              </div>
            </div>
          </div>
        );

      case 'dataControls':
        return (
          <div className={styles.tabContent}>
            <div className={styles.sessionSection}>
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
