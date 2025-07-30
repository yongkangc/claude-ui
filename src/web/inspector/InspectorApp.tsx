import React, { useState, useEffect, useRef } from 'react';
import LogMonitor from './LogMonitor';
import styles from './styles/inspector.module.css';
import { api } from '../chat/services/api';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'json-viewer': any;
    }
  }
}

function InspectorApp() {
  const [currentStream, setCurrentStream] = useState<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const [availableSessions, setAvailableSessions] = useState<any[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    status: true,
    start: true,
    stop: true,
    list: true,
    rename: true,
    permissions: true,
    permissionDecision: true,
    listDir: true,
    readFile: true,
    workingDirs: true,
    commands: true,
    bulkOperations: true,
    geminiHealth: true,
    geminiTranscribe: true,
    geminiSummarize: true,
  });

  // Form states
  const [workingDir, setWorkingDir] = useState('/tmp');
  const [initialPrompt, setInitialPrompt] = useState('Hello');
  const [model, setModel] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [claudeExecutablePath, setClaudeExecutablePath] = useState('');
  const [permissionMode, setPermissionMode] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [streamingId, setStreamingId] = useState('');
  const [stopStreamingId, setStopStreamingId] = useState('');
  const [detailSessionId, setDetailSessionId] = useState('');
  const [sidebarConversationsLimit, setSidebarConversationsLimit] = useState('20');
  const [sidebarConversationsOffset, setSidebarConversationsOffset] = useState('0');
  const [sidebarConversationsProjectPath, setSidebarConversationsProjectPath] = useState('');
  const [permissionsStreamingId, setPermissionsStreamingId] = useState('');
  const [permissionsStatus, setPermissionsStatus] = useState('');
  const [listPath, setListPath] = useState('');
  const [listRecursive, setListRecursive] = useState(false);
  const [listRespectGitignore, setListRespectGitignore] = useState(false);
  const [readPath, setReadPath] = useState('');
  const [logMonitorVisible, setLogMonitorVisible] = useState(false);
  
  // Update session states
  const [renameSessionId, setRenameSessionId] = useState('');
  const [renameCustomName, setRenameCustomName] = useState('');
  const [sessionPinned, setSessionPinned] = useState(false);
  const [sessionArchived, setSessionArchived] = useState(false);
  const [continuationSessionId, setContinuationSessionId] = useState('');
  const [initialCommitHead, setInitialCommitHead] = useState('');
  const [sessionPermissionMode, setSessionPermissionMode] = useState('');
  
  // Permission decision states
  const [permissionRequestId, setPermissionRequestId] = useState('');
  const [permissionDecisionBody, setPermissionDecisionBody] = useState(JSON.stringify({
    action: 'approve',
    modifiedInput: {},
    denyReason: ''
  }, null, 2));

  // Result states
  const [results, setResults] = useState<Record<string, any>>({});
  
  // Working directories state
  const [workingDirectories, setWorkingDirectories] = useState<any[]>([]);
  const [streamResult, setStreamResult] = useState<JSX.Element[]>([]);
  
  // Commands state
  const [commandsWorkingDirectory, setCommandsWorkingDirectory] = useState('');
  
  // Gemini API states
  const [geminiAudioFile, setGeminiAudioFile] = useState<File | null>(null);
  const [geminiAudioBase64, setGeminiAudioBase64] = useState('');
  const [geminiMimeType, setGeminiMimeType] = useState('audio/wav');
  const [geminiTextToSummarize, setGeminiTextToSummarize] = useState('');

  const streamResultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAvailableSessions();
  }, []);

  const showJson = (resultId: string, data: any) => {
    setResults(prev => ({ ...prev, [resultId]: data }));
  };

  const loadAvailableSessions = async () => {
    try {
      const data = await api.getConversations({ limit: 100 });
      setAvailableSessions(data.conversations || []);
    } catch (e) {
      // Silently fail
    }
  };

  const getWorkingDirectories = async () => {
    try {
      const data = await api.getWorkingDirectories();
      showJson('workingDirsResult', data);
      if (data.directories) {
        setWorkingDirectories(data.directories);
      }
    } catch (e: any) {
      showJson('workingDirsResult', { error: e.message });
    }
  };

  const getCommands = async () => {
    try {
      const data = await api.getCommands(commandsWorkingDirectory || undefined);
      showJson('commandsResult', data);
    } catch (e: any) {
      showJson('commandsResult', { error: e.message });
    }
  };

  const toggleCollapse = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getSystemStatus = async () => {
    try {
      const data = await api.getSystemStatus();
      showJson('statusResult', data);
    } catch (e: any) {
      showJson('statusResult', { error: e.message });
    }
  };

  const listConversationsSidebar = async () => {
    try {
      const data = await api.getConversations({
        limit: sidebarConversationsLimit ? parseInt(sidebarConversationsLimit) : undefined,
        offset: sidebarConversationsOffset ? parseInt(sidebarConversationsOffset) : undefined,
        projectPath: sidebarConversationsProjectPath || undefined
      });
      showJson('sidebarConversationsResult', data);

      if (data.conversations) {
        setAvailableSessions(data.conversations);
      }
    } catch (e: any) {
      showJson('sidebarConversationsResult', { error: e.message });
    }
  };

  const startConversation = async () => {
    try {
      const body: any = {
        workingDirectory: workingDir,
        initialPrompt: initialPrompt
      };

      if (model) body.model = model;
      if (systemPrompt) body.systemPrompt = systemPrompt;
      if (claudeExecutablePath) body.claudeExecutablePath = claudeExecutablePath;
      if (permissionMode) body.permissionMode = permissionMode;

      const data = await api.startConversation(body);
      showJson('startResult', data);

      if (data.streamingId) {
        setStreamingId(data.streamingId);
        setStopStreamingId(data.streamingId);
        startStream(data.streamingId);
        loadAvailableSessions();
      }
    } catch (e: any) {
      showJson('startResult', { error: e.message });
    }
  };


  const startStream = async (id?: string) => {
    const streamId = id || streamingId;
    if (!streamId) {
      setStreamResult([<span key="error" style={{ color: '#ff6b6b' }}>Please enter a streaming ID</span>]);
      return;
    }

    setStreamResult([<span key="connecting" style={{ color: '#51cf66' }}>Connecting to stream...</span>]);

    try {
      const response = await api.fetchWithAuth(api.getStreamUrl(streamId));
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      setCurrentStream(reader);
      let buffer = '';
      let lineCount = 0;
      let hasReceivedFirstMessage = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          setStreamResult(prev => [...prev, <span key="ended" style={{ color: '#868e96' }}>[Stream ended]</span>]);
          break;
        }

        const decoded = decoder.decode(value, { stream: true });
        buffer += decoded;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        const newLines: JSX.Element[] = [];
        
        for (const line of lines) {
          if (line.trim()) {
            // Parse SSE format: remove "data: " prefix
            let jsonLine = line;
            if (line.startsWith('data: ')) {
              jsonLine = line.substring(6);
            }
            
            // Skip SSE comments (lines starting with :)
            if (line.startsWith(':')) {
              continue;
            }
            
            lineCount++;
            const newLine = (
              <div key={`line-${lineCount}`} className={styles.streamLine}>
                <span style={{ color: '#868e96' }}>{lineCount}:</span> {jsonLine}
              </div>
            );
            newLines.push(newLine);
          }
        }

        if (newLines.length > 0) {
          // Clear the "Connecting..." message on first real data
          if (!hasReceivedFirstMessage) {
            hasReceivedFirstMessage = true;
            setStreamResult(newLines);
          } else {
            setStreamResult(prev => [...prev, ...newLines]);
          }
        }
      }
    } catch (e: any) {
      setStreamResult(prev => [...prev, <span key="error" style={{ color: '#ff6b6b' }}>Error: {e.message}</span>]);
    }
  };

  const stopStream = () => {
    if (currentStream) {
      currentStream.cancel();
      setCurrentStream(null);
      setStreamResult(prev => [...prev, <span key="stopped" style={{ color: '#ffd43b' }}>[Stream stopped by user]</span>]);
    }
  };

  const clearStream = () => {
    setStreamResult([]);
  };

  const stopConversation = async () => {
    try {
      const data = await api.stopConversation(stopStreamingId);
      showJson('stopResult', data);
    } catch (e: any) {
      showJson('stopResult', { error: e.message });
    }
  };

  const getConversationDetails = async () => {
    try {
      const data = await api.getConversationDetails(detailSessionId);
      showJson('detailsResult', data);
    } catch (e: any) {
      showJson('detailsResult', { error: e.message });
    }
  };

  const listPermissions = async () => {
    try {
      const data = await api.getPermissions({
        streamingId: permissionsStreamingId || undefined,
        status: permissionsStatus as 'pending' | 'approved' | 'denied' | undefined
      });
      showJson('permissionsResult', data);
    } catch (e: any) {
      showJson('permissionsResult', { error: e.message });
    }
  };

  const listDirectory = async () => {
    try {
      if (!listPath) {
        showJson('listResult', { error: 'Path is required' });
        return;
      }

      const data = await api.listDirectory({
        path: listPath,
        recursive: listRecursive,
        respectGitignore: listRespectGitignore
      });
      showJson('listResult', data);
    } catch (e: any) {
      showJson('listResult', { error: e.message });
    }
  };

  const readFile = async () => {
    try {
      if (!readPath) {
        showJson('readResult', { error: 'Path is required' });
        return;
      }

      const data = await api.readFile(readPath);
      showJson('readResult', data);
    } catch (e: any) {
      showJson('readResult', { error: e.message });
    }
  };

  const renameSession = async () => {
    try {
      if (!renameSessionId) {
        showJson('renameResult', { error: 'Session ID is required' });
        return;
      }

      // Use the new update endpoint with all fields
      const updateData: any = {};
      
      // Only include fields that have values or are explicitly set
      if (renameCustomName.trim() !== '') updateData.customName = renameCustomName.trim();
      updateData.pinned = sessionPinned;
      updateData.archived = sessionArchived;
      if (continuationSessionId.trim() !== '') updateData.continuationSessionId = continuationSessionId.trim();
      if (initialCommitHead.trim() !== '') updateData.initialCommitHead = initialCommitHead.trim();
      if (sessionPermissionMode.trim() !== '') updateData.permissionMode = sessionPermissionMode.trim();
      
      const data = await api.updateSession(renameSessionId, updateData);
      showJson('renameResult', data);
      
      // Refresh available sessions to show updated names
      if (data.success) {
        loadAvailableSessions();
      }
    } catch (e: any) {
      showJson('renameResult', { error: e.message });
    }
  };
  
  const archiveAllSessions = async () => {
    try {
      const data = await api.archiveAllSessions();
      showJson('archiveAllResult', data);
      
      // Refresh available sessions to show updated archive status
      if (data.success) {
        loadAvailableSessions();
      }
    } catch (e: any) {
      showJson('archiveAllResult', { error: e.message });
    }
  };
  
  const makePermissionDecision = async () => {
    try {
      if (!permissionRequestId) {
        showJson('permissionDecisionResult', { error: 'Request ID is required' });
        return;
      }

      let body;
      try {
        body = JSON.parse(permissionDecisionBody);
      } catch (e) {
        showJson('permissionDecisionResult', { error: 'Invalid JSON body' });
        return;
      }

      const data = await api.sendPermissionDecision(permissionRequestId, body);
      showJson('permissionDecisionResult', data);
    } catch (e: any) {
      showJson('permissionDecisionResult', { error: e.message });
    }
  };

  const getGeminiHealth = async () => {
    try {
      const response = await api.fetchWithAuth('/api/gemini/health');
      const data = await response.json();
      showJson('geminiHealthResult', data);
    } catch (e: any) {
      showJson('geminiHealthResult', { error: e.message });
    }
  };

  const transcribeAudio = async () => {
    try {
      let body: any = {};
      
      if (geminiAudioFile) {
        // Use file upload
        const formData = new FormData();
        formData.append('audio', geminiAudioFile);
        
        const response = await api.fetchWithAuth('/api/gemini/transcribe', {
          method: 'POST',
          body: formData
        });
        const data = await response.json();
        showJson('geminiTranscribeResult', data);
      } else if (geminiAudioBase64) {
        // Use base64
        const response = await api.fetchWithAuth('/api/gemini/transcribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            audio: geminiAudioBase64,
            mimeType: geminiMimeType
          })
        });
        const data = await response.json();
        showJson('geminiTranscribeResult', data);
      } else {
        showJson('geminiTranscribeResult', { error: 'Please provide an audio file or base64 data' });
      }
    } catch (e: any) {
      showJson('geminiTranscribeResult', { error: e.message });
    }
  };

  const summarizeText = async () => {
    try {
      if (!geminiTextToSummarize) {
        showJson('geminiSummarizeResult', { error: 'Please provide text to summarize' });
        return;
      }

      const response = await api.fetchWithAuth('/api/gemini/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: geminiTextToSummarize
        })
      });
      const data = await response.json();
      showJson('geminiSummarizeResult', data);
    } catch (e: any) {
      showJson('geminiSummarizeResult', { error: e.message });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setGeminiAudioFile(e.target.files[0]);
      setGeminiAudioBase64(''); // Clear base64 when file is selected
    }
  };

  const copyJsonToClipboard = async (data: any, buttonRef: HTMLButtonElement) => {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(jsonString);
      
      const originalText = buttonRef.textContent;
      buttonRef.textContent = 'Copied!';
      buttonRef.classList.add(styles.copied);
      
      setTimeout(() => {
        buttonRef.textContent = originalText;
        buttonRef.classList.remove(styles.copied);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const copyStreamToClipboard = async (buttonRef: HTMLButtonElement) => {
    try {
      const content = streamResult
        .filter(el => el.type === 'div')
        .map(el => el.props.children[2])
        .join('\n');
      
      await navigator.clipboard.writeText(content);
      
      const originalText = buttonRef.textContent;
      buttonRef.textContent = 'Copied!';
      buttonRef.classList.add(styles.copied);
      
      setTimeout(() => {
        buttonRef.textContent = originalText;
        buttonRef.classList.remove(styles.copied);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const JsonViewer = ({ data, resultId }: { data: any, resultId: string }) => (
    <div className={styles.jsonViewerWrapper}>
      <button className={styles.copyBtn} onClick={(e) => copyJsonToClipboard(data, e.currentTarget)}>
        Copy JSON
      </button>
      <json-viewer data={JSON.stringify(data)}></json-viewer>
    </div>
  );

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <div className={styles.sidebar}>
        <h1>CUI Raw JSON Interface</h1>
        
        {/* System Status */}
        <div className={styles.section}>
          <div className={`${styles.endpoint} ${styles.collapsible} ${collapsed.status ? styles.collapsed : ''}`} onClick={() => toggleCollapse('status')}>
            GET /api/system/status
          </div>
          <div className={styles.collapsibleContent}>
            <button onClick={getSystemStatus}>Get Status</button>
            <div id="statusResult" className={styles.jsonViewerContainer}>
              {results.statusResult && <JsonViewer data={results.statusResult} resultId="statusResult" />}
            </div>
            {results.statusResult && !results.statusResult.error && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                <div><strong>Claude Version:</strong> {results.statusResult.claudeVersion}</div>
                <div><strong>Claude Path:</strong> {results.statusResult.claudePath}</div>
                <div><strong>Config Path:</strong> {results.statusResult.configPath}</div>
                <div><strong>Active Conversations:</strong> {results.statusResult.activeConversations}</div>
                <div><strong>Machine ID:</strong> {results.statusResult.machineId}</div>
              </div>
            )}
          </div>
        </div>

        {/* Working Directories */}
        <div className={styles.section}>
          <div className={`${styles.endpoint} ${styles.collapsible} ${collapsed.workingDirs ? styles.collapsed : ''}`} onClick={() => toggleCollapse('workingDirs')}>
            GET /api/working-directories
          </div>
          <div className={styles.collapsibleContent}>
            <button onClick={getWorkingDirectories}>Get Working Directories</button>
            <div id="workingDirsResult" className={styles.jsonViewerContainer}>
              {results.workingDirsResult && <JsonViewer data={results.workingDirsResult} resultId="workingDirsResult" />}
            </div>
            {workingDirectories.length > 0 && (
              <div className={styles.workingDirsList} style={{ marginTop: '10px' }}>
                <h4 style={{ margin: '5px 0' }}>Quick Select:</h4>
                {workingDirectories.map((dir: any, index: number) => (
                  <div key={index} style={{ marginBottom: '5px' }}>
                    <button 
                      style={{ fontSize: '12px', padding: '2px 5px', marginRight: '5px' }}
                      onClick={() => {
                        setWorkingDir(dir.path);
                        setListPath(dir.path);
                      }}
                      title={dir.path}
                    >
                      {dir.shortname}
                    </button>
                    <span style={{ fontSize: '11px', color: '#666' }}>
                      ({dir.conversationCount} convs, {new Date(dir.lastDate).toLocaleDateString()})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Commands API */}
        <div className={styles.section}>
          <div className={`${styles.endpoint} ${styles.collapsible} ${collapsed.commands ? styles.collapsed : ''}`} onClick={() => toggleCollapse('commands')}>
            GET /api/system/commands
          </div>
          <div className={styles.collapsibleContent}>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Working Directory <span className={styles.optional}>(optional)</span></div>
              <input type="text" value={commandsWorkingDirectory} onChange={(e) => setCommandsWorkingDirectory(e.target.value)} placeholder="/path/to/working/directory" />
            </div>
            <button onClick={getCommands}>Get Commands</button>
            <div id="commandsResult" className={styles.jsonViewerContainer}>
              {results.commandsResult && <JsonViewer data={results.commandsResult} resultId="commandsResult" />}
            </div>
          </div>
        </div>
        
        {/* Start Conversation */}
        <div className={styles.section}>
          <div className={`${styles.endpoint} ${styles.collapsible} ${collapsed.start ? styles.collapsed : ''}`} onClick={() => toggleCollapse('start')}>
            POST /api/conversations/start
          </div>
          <div className={styles.collapsibleContent}>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Working Directory <span style={{ color: 'red' }}>*</span></div>
              <input type="text" value={workingDir} onChange={(e) => setWorkingDir(e.target.value)} placeholder="/Users/..." />
            </div>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Initial Prompt <span style={{ color: 'red' }}>*</span></div>
              <textarea value={initialPrompt} onChange={(e) => setInitialPrompt(e.target.value)} rows={3} placeholder="Your prompt here..." />
            </div>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Model <span className={styles.optional}>(optional)</span></div>
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="">Default</option>
                <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
              </select>
            </div>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>System Prompt <span className={styles.optional}>(optional)</span></div>
              <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={2} placeholder="System prompt..." />
            </div>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Claude Executable Path <span className={styles.optional}>(optional)</span></div>
              <input type="text" value={claudeExecutablePath} onChange={(e) => setClaudeExecutablePath(e.target.value)} placeholder="/usr/local/bin/claude" />
            </div>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Permission Mode <span className={styles.optional}>(optional)</span></div>
              <select value={permissionMode} onChange={(e) => setPermissionMode(e.target.value)}>
                <option value="">Default</option>
                <option value="default">default</option>
                <option value="acceptEdits">acceptEdits</option>
                <option value="bypassPermissions">bypassPermissions</option>
                <option value="plan">plan</option>
              </select>
            </div>
            <button onClick={startConversation}>Start Conversation</button>
            <div id="startResult" className={styles.jsonViewerContainer}>
              {results.startResult && <JsonViewer data={results.startResult} resultId="startResult" />}
            </div>
          </div>
        </div>
        
        {/* Stop Conversation */}
        <div className={styles.section}>
          <div className={`${styles.endpoint} ${styles.collapsible} ${collapsed.stop ? styles.collapsed : ''}`} onClick={() => toggleCollapse('stop')}>
            POST /api/conversations/:streamingId/stop
          </div>
          <div className={styles.collapsibleContent}>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Streaming ID <span style={{ color: 'red' }}>*</span></div>
              <input type="text" value={stopStreamingId} onChange={(e) => setStopStreamingId(e.target.value)} placeholder="streaming-id" />
            </div>
            <button onClick={stopConversation}>Stop Conversation</button>
            <div id="stopResult" className={styles.jsonViewerContainer}>
              {results.stopResult && <JsonViewer data={results.stopResult} resultId="stopResult" />}
            </div>
          </div>
        </div>
        
        {/* List Conversations */}
        <div className={styles.section}>
          <div className={`${styles.endpoint} ${styles.collapsible} ${collapsed.list ? styles.collapsed : ''}`} onClick={() => toggleCollapse('list')}>
            GET /api/conversations
          </div>
          <div className={styles.collapsibleContent}>
            <div className={styles.fieldGroup}>
              <div className={styles.inlineFields}>
                <div>
                  <div className={styles.fieldLabel}>Limit <span className={styles.optional}>(optional)</span></div>
                  <input type="number" value={sidebarConversationsLimit} onChange={(e) => setSidebarConversationsLimit(e.target.value)} placeholder="20" />
                </div>
                <div>
                  <div className={styles.fieldLabel}>Offset <span className={styles.optional}>(optional)</span></div>
                  <input type="number" value={sidebarConversationsOffset} onChange={(e) => setSidebarConversationsOffset(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <div className={styles.fieldLabel}>Project Path <span className={styles.optional}>(optional)</span></div>
                  <input type="text" value={sidebarConversationsProjectPath} onChange={(e) => setSidebarConversationsProjectPath(e.target.value)} placeholder="/path/to/project" />
                </div>
              </div>
            </div>
            <button onClick={listConversationsSidebar}>List Conversations</button>
            <div id="sidebarConversationsResult" className={styles.jsonViewerContainer}>
              {results.sidebarConversationsResult && <JsonViewer data={results.sidebarConversationsResult} resultId="sidebarConversationsResult" />}
            </div>
          </div>
        </div>
        
        {/* Update Session (includes rename) */}
        <div className={styles.section}>
          <div className={`${styles.endpoint} ${styles.collapsible} ${collapsed.rename ? styles.collapsed : ''}`} onClick={() => toggleCollapse('rename')}>
            PUT /api/conversations/:sessionId/update
          </div>
          <div className={styles.collapsibleContent}>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Session ID <span style={{ color: 'red' }}>*</span></div>
              <select value={renameSessionId} onChange={(e) => setRenameSessionId(e.target.value)} style={{ marginBottom: 5 }}>
                <option value="">Select a session...</option>
                {availableSessions.map(session => {
                  const summary = session.summary || 'No summary';
                  const customName = session.sessionInfo?.custom_name || '';
                  const sessionFlags = [];
                  if (session.sessionInfo?.pinned) sessionFlags.push('📌');
                  if (session.sessionInfo?.archived) sessionFlags.push('📦');
                  if (session.sessionInfo?.continuation_session_id) sessionFlags.push('🔗');
                  if (session.sessionInfo?.initial_commit_head) sessionFlags.push('🔀');
                  if (session.sessionInfo?.permission_mode && session.sessionInfo.permission_mode !== 'default') sessionFlags.push(`🔒${session.sessionInfo.permission_mode}`);
                  const flagsStr = sessionFlags.length > 0 ? ` ${sessionFlags.join('')}` : '';
                  const displayName = customName ? `[${customName}] ${summary}` : summary;
                  const date = new Date(session.updatedAt).toLocaleString();
                  const metrics = session.toolMetrics;
                  const metricsStr = metrics ? ` [📝${metrics.editCount} ✏️${metrics.writeCount} +${metrics.linesAdded} -${metrics.linesRemoved}]` : '';
                  return (
                    <option key={session.sessionId} value={session.sessionId} title={`${session.sessionId}\n${summary}\nPath: ${session.projectPath}\nUpdated: ${date}\n\nSession Info:\n${JSON.stringify(session.sessionInfo, null, 2)}${metrics ? `\n\nTool Metrics:\nEdits: ${metrics.editCount}\nWrites: ${metrics.writeCount}\nLines Added: ${metrics.linesAdded}\nLines Removed: ${metrics.linesRemoved}` : ''}`}>
                      {session.sessionId.substring(0, 8)}... - {displayName.substring(0, 50)}...{flagsStr}{metricsStr} ({date})
                    </option>
                  );
                })}
              </select>
              <input type="text" value={renameSessionId} onChange={(e) => setRenameSessionId(e.target.value)} placeholder="claude-session-id or select from dropdown" />
            </div>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Custom Name <span className={styles.optional}>(empty to clear)</span></div>
              <input type="text" value={renameCustomName} onChange={(e) => setRenameCustomName(e.target.value)} placeholder="My Project Discussion" maxLength={200} />
              <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                {renameCustomName.length}/200 characters
              </div>
            </div>
            <div className={styles.fieldGroup}>
              <div className={styles.inlineFields}>
                <div>
                  <input type="checkbox" id="sessionPinned" checked={sessionPinned} onChange={(e) => setSessionPinned(e.target.checked)} />
                  <label htmlFor="sessionPinned">Pinned</label>
                </div>
                <div>
                  <input type="checkbox" id="sessionArchived" checked={sessionArchived} onChange={(e) => setSessionArchived(e.target.checked)} />
                  <label htmlFor="sessionArchived">Archived</label>
                </div>
              </div>
            </div>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Continuation Session ID <span className={styles.optional}>(optional)</span></div>
              <input type="text" value={continuationSessionId} onChange={(e) => setContinuationSessionId(e.target.value)} placeholder="claude-session-id" />
            </div>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Initial Commit HEAD <span className={styles.optional}>(optional)</span></div>
              <input type="text" value={initialCommitHead} onChange={(e) => setInitialCommitHead(e.target.value)} placeholder="git commit hash" />
            </div>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Permission Mode <span className={styles.optional}>(optional)</span></div>
              <select value={sessionPermissionMode} onChange={(e) => setSessionPermissionMode(e.target.value)}>
                <option value="">Keep current</option>
                <option value="default">default</option>
                <option value="acceptEdits">acceptEdits</option>
                <option value="bypassPermissions">bypassPermissions</option>
                <option value="plan">plan</option>
              </select>
            </div>
            <button onClick={renameSession}>Update Session</button>
            <div id="renameResult" className={styles.jsonViewerContainer}>
              {results.renameResult && <JsonViewer data={results.renameResult} resultId="renameResult" />}
            </div>
          </div>
        </div>
        
        {/* List Permissions */}
        <div className={styles.section}>
          <div className={`${styles.endpoint} ${styles.collapsible} ${collapsed.permissions ? styles.collapsed : ''}`} onClick={() => toggleCollapse('permissions')}>
            GET /api/permissions
          </div>
          <div className={styles.collapsibleContent}>
            <div className={styles.fieldGroup}>
              <div className={styles.inlineFields}>
                <div>
                  <div className={styles.fieldLabel}>Streaming ID <span className={styles.optional}>(optional)</span></div>
                  <input type="text" value={permissionsStreamingId} onChange={(e) => setPermissionsStreamingId(e.target.value)} placeholder="streaming-id" />
                </div>
                <div>
                  <div className={styles.fieldLabel}>Status <span className={styles.optional}>(optional)</span></div>
                  <select value={permissionsStatus} onChange={(e) => setPermissionsStatus(e.target.value)}>
                    <option value="">All</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="denied">Denied</option>
                  </select>
                </div>
              </div>
            </div>
            <button onClick={listPermissions}>List Permissions</button>
            <div id="permissionsResult" className={styles.jsonViewerContainer}>
              {results.permissionsResult && <JsonViewer data={results.permissionsResult} resultId="permissionsResult" />}
            </div>
          </div>
        </div>
        
        {/* Permission Decision */}
        <div className={styles.section}>
          <div className={`${styles.endpoint} ${styles.collapsible} ${collapsed.permissionDecision ? styles.collapsed : ''}`} onClick={() => toggleCollapse('permissionDecision')}>
            POST /api/permissions/:requestId/decision
          </div>
          <div className={styles.collapsibleContent}>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Request ID <span style={{ color: 'red' }}>*</span></div>
              <input type="text" value={permissionRequestId} onChange={(e) => setPermissionRequestId(e.target.value)} placeholder="permission-request-id" />
            </div>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Request Body <span style={{ color: 'red' }}>*</span></div>
              <textarea 
                value={permissionDecisionBody} 
                onChange={(e) => setPermissionDecisionBody(e.target.value)} 
                rows={10} 
                placeholder={JSON.stringify({
                  action: 'approve',
                  modifiedInput: {},
                  denyReason: ''
                }, null, 2)}
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
              />
            </div>
            <button onClick={makePermissionDecision}>Make Decision</button>
            <div id="permissionDecisionResult" className={styles.jsonViewerContainer}>
              {results.permissionDecisionResult && <JsonViewer data={results.permissionDecisionResult} resultId="permissionDecisionResult" />}
            </div>
          </div>
        </div>

        {/* List Directory */}
        <div className={styles.section}>
          <div className={`${styles.endpoint} ${styles.collapsible} ${collapsed.listDir ? styles.collapsed : ''}`} onClick={() => toggleCollapse('listDir')}>
            GET /api/filesystem/list
          </div>
          <div className={styles.collapsibleContent}>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Path <span style={{ color: 'red' }}>*</span></div>
              <input type="text" value={listPath} onChange={(e) => setListPath(e.target.value)} placeholder="/absolute/path/to/directory" />
            </div>
            <div className={styles.fieldGroup}>
              <div className={styles.inlineFields}>
                <div>
                  <input type="checkbox" id="listRecursive" checked={listRecursive} onChange={(e) => setListRecursive(e.target.checked)} />
                  <label htmlFor="listRecursive">Recursive</label>
                </div>
                <div>
                  <input type="checkbox" id="listRespectGitignore" checked={listRespectGitignore} onChange={(e) => setListRespectGitignore(e.target.checked)} />
                  <label htmlFor="listRespectGitignore">Respect .gitignore</label>
                </div>
              </div>
            </div>
            <button onClick={listDirectory}>List Directory</button>
            <div id="listResult" className={styles.jsonViewerContainer}>
              {results.listResult && <JsonViewer data={results.listResult} resultId="listResult" />}
            </div>
          </div>
        </div>

        {/* Read File */}
        <div className={styles.section}>
          <div className={`${styles.endpoint} ${styles.collapsible} ${collapsed.readFile ? styles.collapsed : ''}`} onClick={() => toggleCollapse('readFile')}>
            GET /api/filesystem/read
          </div>
          <div className={styles.collapsibleContent}>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Path <span style={{ color: 'red' }}>*</span></div>
              <input type="text" value={readPath} onChange={(e) => setReadPath(e.target.value)} placeholder="/absolute/path/to/file.txt" />
            </div>
            <button onClick={readFile}>Read File</button>
            <div id="readResult" className={styles.jsonViewerContainer}>
              {results.readResult && <JsonViewer data={results.readResult} resultId="readResult" />}
            </div>
          </div>
        </div>

        {/* Bulk Operations */}
        <div className={styles.section}>
          <div className={`${styles.endpoint} ${styles.collapsible} ${collapsed.bulkOperations ? styles.collapsed : ''}`} onClick={() => toggleCollapse('bulkOperations')}>
            Bulk Operations
          </div>
          <div className={styles.collapsibleContent}>
            <div style={{ marginBottom: '10px' }}>
              <h4 style={{ margin: '5px 0' }}>Archive All Sessions</h4>
              <p style={{ fontSize: '12px', color: '#666', margin: '5px 0' }}>
                Archive all non-archived sessions at once. This action cannot be undone.
              </p>
              <button onClick={archiveAllSessions} style={{ background: '#e74c3c' }}>Archive All Sessions</button>
              <div id="archiveAllResult" className={styles.jsonViewerContainer}>
                {results.archiveAllResult && <JsonViewer data={results.archiveAllResult} resultId="archiveAllResult" />}
              </div>
            </div>
          </div>
        </div>

        {/* Gemini Health Check */}
        <div className={styles.section}>
          <div className={`${styles.endpoint} ${styles.collapsible} ${collapsed.geminiHealth ? styles.collapsed : ''}`} onClick={() => toggleCollapse('geminiHealth')}>
            GET /api/gemini/health
          </div>
          <div className={styles.collapsibleContent}>
            <button onClick={getGeminiHealth}>Check Gemini Health</button>
            <div id="geminiHealthResult" className={styles.jsonViewerContainer}>
              {results.geminiHealthResult && <JsonViewer data={results.geminiHealthResult} resultId="geminiHealthResult" />}
            </div>
          </div>
        </div>

        {/* Gemini Transcribe */}
        <div className={styles.section}>
          <div className={`${styles.endpoint} ${styles.collapsible} ${collapsed.geminiTranscribe ? styles.collapsed : ''}`} onClick={() => toggleCollapse('geminiTranscribe')}>
            POST /api/gemini/transcribe
          </div>
          <div className={styles.collapsibleContent}>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Audio File Upload</div>
              <input type="file" accept="audio/*" onChange={handleFileChange} />
              {geminiAudioFile && <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>Selected: {geminiAudioFile.name}</div>}
            </div>
            <div style={{ margin: '10px 0', textAlign: 'center' }}>
              <span style={{ color: '#666' }}>— OR —</span>
            </div>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Base64 Audio Data</div>
              <textarea 
                value={geminiAudioBase64} 
                onChange={(e) => {
                  setGeminiAudioBase64(e.target.value);
                  setGeminiAudioFile(null); // Clear file when base64 is entered
                }} 
                rows={4} 
                placeholder="Base64 encoded audio data..."
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
              />
            </div>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>MIME Type <span className={styles.optional}>(for base64)</span></div>
              <select value={geminiMimeType} onChange={(e) => setGeminiMimeType(e.target.value)}>
                <option value="audio/wav">audio/wav</option>
                <option value="audio/mp3">audio/mp3</option>
                <option value="audio/mpeg">audio/mpeg</option>
                <option value="audio/ogg">audio/ogg</option>
                <option value="audio/webm">audio/webm</option>
              </select>
            </div>
            <button onClick={transcribeAudio}>Transcribe Audio</button>
            <div id="geminiTranscribeResult" className={styles.jsonViewerContainer}>
              {results.geminiTranscribeResult && <JsonViewer data={results.geminiTranscribeResult} resultId="geminiTranscribeResult" />}
            </div>
          </div>
        </div>

        {/* Gemini Summarize */}
        <div className={styles.section}>
          <div className={`${styles.endpoint} ${styles.collapsible} ${collapsed.geminiSummarize ? styles.collapsed : ''}`} onClick={() => toggleCollapse('geminiSummarize')}>
            POST /api/gemini/summarize
          </div>
          <div className={styles.collapsibleContent}>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Text to Summarize <span style={{ color: 'red' }}>*</span></div>
              <textarea 
                value={geminiTextToSummarize} 
                onChange={(e) => setGeminiTextToSummarize(e.target.value)} 
                rows={8} 
                placeholder="Enter text to summarize..."
              />
              <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                {geminiTextToSummarize.length} characters
              </div>
            </div>
            <button onClick={summarizeText}>Summarize Text</button>
            <div id="geminiSummarizeResult" className={styles.jsonViewerContainer}>
              {results.geminiSummarizeResult && <JsonViewer data={results.geminiSummarizeResult} resultId="geminiSummarizeResult" />}
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className={styles.main}>
        <div className={styles.mainContent}>
          {/* Get Conversation Details */}
          <div className={styles.section}>
          <div className={styles.endpoint}>GET /api/conversations/:sessionId</div>
          <div className={styles.fieldGroup}>
            <div className={styles.fieldLabel}>Session ID <span style={{ color: 'red' }}>*</span></div>
            <select value={detailSessionId} onChange={(e) => setDetailSessionId(e.target.value)} style={{ marginBottom: 5 }}>
              <option value="">Select a session...</option>
              {availableSessions.map(session => {
                const summary = session.summary || 'No summary';
                const customName = session.sessionInfo?.custom_name || '';
                const displayName = customName ? `[${customName}] ${summary}` : summary;
                const date = new Date(session.updatedAt).toLocaleString();
                const metrics = session.toolMetrics;
                const metricsStr = metrics ? ` [📝${metrics.editCount} ✏️${metrics.writeCount} +${metrics.linesAdded} -${metrics.linesRemoved}]` : '';
                return (
                  <option key={session.sessionId} value={session.sessionId} title={`${session.sessionId}\n${summary}\nPath: ${session.projectPath}\nUpdated: ${date}\n\nSession Info:\n${JSON.stringify(session.sessionInfo, null, 2)}${metrics ? `\n\nTool Metrics:\nEdits: ${metrics.editCount}\nWrites: ${metrics.writeCount}\nLines Added: ${metrics.linesAdded}\nLines Removed: ${metrics.linesRemoved}` : ''}`}>
                    {session.sessionId.substring(0, 8)}... - {displayName.substring(0, 50)}...{metricsStr} ({date})
                  </option>
                );
              })}
            </select>
            <input type="text" value={detailSessionId} onChange={(e) => setDetailSessionId(e.target.value)} placeholder="claude-session-id or select from dropdown" />
          </div>
          <button onClick={getConversationDetails}>Get Details</button>
          <div id="detailsResult" className={styles.jsonViewerContainer}>
            {results.detailsResult && <JsonViewer data={results.detailsResult} resultId="detailsResult" />}
          </div>
        </div>
        
        {/* Stream */}
        <div className={styles.section}>
          <div className={styles.endpoint}>GET /api/stream/:streamingId</div>
          <div className={styles.fieldGroup}>
            <div className={styles.fieldLabel}>Streaming ID <span style={{ color: 'red' }}>*</span></div>
            <input type="text" value={streamingId} onChange={(e) => setStreamingId(e.target.value)} placeholder="streaming-id" />
          </div>
          <button onClick={() => startStream()}>Start Stream</button>
          <button onClick={stopStream}>Stop Stream</button>
          <button onClick={clearStream}>Clear</button>
          <button onClick={(e) => copyStreamToClipboard(e.currentTarget)}>Copy Stream</button>
          <div id="streamResult" className={styles.streamContainer} ref={streamResultRef}>
            {streamResult}
          </div>
        </div>
        </div>
        <LogMonitor 
          isVisible={logMonitorVisible}
          onToggle={() => setLogMonitorVisible(!logMonitorVisible)}
        />
      </div>
    </div>
  );
}

export default InspectorApp;