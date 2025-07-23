import React, { useState, useEffect, useRef } from 'react';
import LogWindow from './LogWindow';
import './styles/console.css';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'json-viewer': any;
    }
  }
}

function ConsoleApp() {
  const [currentStream, setCurrentStream] = useState<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const [availableSessions, setAvailableSessions] = useState<any[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    status: true,
    start: true,
    resume: true,
    stop: true,
    list: true,
    rename: true,
    permissions: true,
    permissionDecision: true,
    listDir: true,
    readFile: true,
    workingDirs: true,
  });

  // Form states
  const [workingDir, setWorkingDir] = useState('/tmp');
  const [initialPrompt, setInitialPrompt] = useState('Hello');
  const [model, setModel] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [claudeExecutablePath, setClaudeExecutablePath] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [resumeMessage, setResumeMessage] = useState('');
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
  const [logWindowVisible, setLogWindowVisible] = useState(false);
  
  // Update session states
  const [renameSessionId, setRenameSessionId] = useState('');
  const [renameCustomName, setRenameCustomName] = useState('');
  const [sessionPinned, setSessionPinned] = useState(false);
  const [sessionArchived, setSessionArchived] = useState(false);
  const [continuationSessionId, setContinuationSessionId] = useState('');
  const [initialCommitHead, setInitialCommitHead] = useState('');
  
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

  const streamResultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAvailableSessions();
  }, []);

  const showJson = (resultId: string, data: any) => {
    setResults(prev => ({ ...prev, [resultId]: data }));
  };

  const loadAvailableSessions = async () => {
    try {
      const response = await fetch('/api/conversations?limit=100&sortBy=updated&order=desc');
      const data = await response.json();
      setAvailableSessions(data.conversations || []);
    } catch (e) {
      // Silently fail
    }
  };

  const getWorkingDirectories = async () => {
    try {
      const response = await fetch('/api/working-directories');
      const data = await response.json();
      showJson('workingDirsResult', data);
      if (data.directories) {
        setWorkingDirectories(data.directories);
      }
    } catch (e: any) {
      showJson('workingDirsResult', { error: e.message });
    }
  };

  const toggleCollapse = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getSystemStatus = async () => {
    try {
      const response = await fetch('/api/system/status');
      const data = await response.json();
      showJson('statusResult', data);
    } catch (e: any) {
      showJson('statusResult', { error: e.message });
    }
  };

  const listConversationsSidebar = async () => {
    try {
      const params = new URLSearchParams();
      if (sidebarConversationsLimit) params.append('limit', sidebarConversationsLimit);
      if (sidebarConversationsOffset) params.append('offset', sidebarConversationsOffset);
      if (sidebarConversationsProjectPath) params.append('projectPath', sidebarConversationsProjectPath);
      params.append('sortBy', 'updated');
      params.append('order', 'desc');

      const response = await fetch(`/api/conversations?${params}`);
      const data = await response.json();
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

      const response = await fetch('/api/conversations/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
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

  const resumeConversation = async () => {
    try {
      const response = await fetch('/api/conversations/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          message: resumeMessage
        })
      });
      const data = await response.json();
      showJson('resumeResult', data);

      if (data.streamingId) {
        setStreamingId(data.streamingId);
        setStopStreamingId(data.streamingId);
        startStream(data.streamingId);
        loadAvailableSessions();
      }
    } catch (e: any) {
      showJson('resumeResult', { error: e.message });
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
      const response = await fetch(`/api/stream/${streamId}`);
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
              <div key={`line-${lineCount}`} className="stream-line">
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
      const response = await fetch(`/api/conversations/${stopStreamingId}/stop`, {
        method: 'POST'
      });
      const data = await response.json();
      showJson('stopResult', data);
    } catch (e: any) {
      showJson('stopResult', { error: e.message });
    }
  };

  const getConversationDetails = async () => {
    try {
      const response = await fetch(`/api/conversations/${detailSessionId}`);
      const data = await response.json();
      showJson('detailsResult', data);
    } catch (e: any) {
      showJson('detailsResult', { error: e.message });
    }
  };

  const listPermissions = async () => {
    try {
      const params = new URLSearchParams();
      if (permissionsStreamingId) params.append('streamingId', permissionsStreamingId);
      if (permissionsStatus) params.append('status', permissionsStatus);

      const response = await fetch(`/api/permissions?${params}`);
      const data = await response.json();
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

      const params = new URLSearchParams();
      params.append('path', listPath);
      if (listRecursive) params.append('recursive', 'true');
      if (listRespectGitignore) params.append('respectGitignore', 'true');

      const response = await fetch(`/api/filesystem/list?${params}`);
      const data = await response.json();
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

      const params = new URLSearchParams();
      params.append('path', readPath);

      const response = await fetch(`/api/filesystem/read?${params}`);
      const data = await response.json();
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
      
      const response = await fetch(`/api/conversations/${renameSessionId}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      const data = await response.json();
      showJson('renameResult', data);
      
      // Refresh available sessions to show updated names
      if (data.success) {
        loadAvailableSessions();
      }
    } catch (e: any) {
      showJson('renameResult', { error: e.message });
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

      const response = await fetch(`/api/permissions/${permissionRequestId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      showJson('permissionDecisionResult', data);
    } catch (e: any) {
      showJson('permissionDecisionResult', { error: e.message });
    }
  };

  const copyJsonToClipboard = async (data: any, buttonRef: HTMLButtonElement) => {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(jsonString);
      
      const originalText = buttonRef.textContent;
      buttonRef.textContent = 'Copied!';
      buttonRef.classList.add('copied');
      
      setTimeout(() => {
        buttonRef.textContent = originalText;
        buttonRef.classList.remove('copied');
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
      buttonRef.classList.add('copied');
      
      setTimeout(() => {
        buttonRef.textContent = originalText;
        buttonRef.classList.remove('copied');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const JsonViewer = ({ data, resultId }: { data: any, resultId: string }) => (
    <div className="json-viewer-wrapper">
      <button className="copy-btn" onClick={(e) => copyJsonToClipboard(data, e.currentTarget)}>
        Copy JSON
      </button>
      <json-viewer data={JSON.stringify(data)}></json-viewer>
    </div>
  );

  return (
    <div className="container">
      {/* Sidebar */}
      <div className="sidebar">
        <h1>CCUI Raw JSON Interface</h1>
        
        {/* System Status */}
        <div className="section">
          <div className={`endpoint collapsible ${collapsed.status ? 'collapsed' : ''}`} onClick={() => toggleCollapse('status')}>
            GET /api/system/status
          </div>
          <div className="collapsible-content">
            <button onClick={getSystemStatus}>Get Status</button>
            <div id="statusResult" className="json-viewer-container">
              {results.statusResult && <JsonViewer data={results.statusResult} resultId="statusResult" />}
            </div>
          </div>
        </div>

        {/* Working Directories */}
        <div className="section">
          <div className={`endpoint collapsible ${collapsed.workingDirs ? 'collapsed' : ''}`} onClick={() => toggleCollapse('workingDirs')}>
            GET /api/working-directories
          </div>
          <div className="collapsible-content">
            <button onClick={getWorkingDirectories}>Get Working Directories</button>
            <div id="workingDirsResult" className="json-viewer-container">
              {results.workingDirsResult && <JsonViewer data={results.workingDirsResult} resultId="workingDirsResult" />}
            </div>
            {workingDirectories.length > 0 && (
              <div className="working-dirs-list" style={{ marginTop: '10px' }}>
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
        
        {/* Start Conversation */}
        <div className="section">
          <div className={`endpoint collapsible ${collapsed.start ? 'collapsed' : ''}`} onClick={() => toggleCollapse('start')}>
            POST /api/conversations/start
          </div>
          <div className="collapsible-content">
            <div className="field-group">
              <div className="field-label">Working Directory <span style={{ color: 'red' }}>*</span></div>
              <input type="text" value={workingDir} onChange={(e) => setWorkingDir(e.target.value)} placeholder="/Users/..." />
            </div>
            <div className="field-group">
              <div className="field-label">Initial Prompt <span style={{ color: 'red' }}>*</span></div>
              <textarea value={initialPrompt} onChange={(e) => setInitialPrompt(e.target.value)} rows={3} placeholder="Your prompt here..." />
            </div>
            <div className="field-group">
              <div className="field-label">Model <span className="optional">(optional)</span></div>
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="">Default</option>
                <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
              </select>
            </div>
            <div className="field-group">
              <div className="field-label">System Prompt <span className="optional">(optional)</span></div>
              <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={2} placeholder="System prompt..." />
            </div>
            <div className="field-group">
              <div className="field-label">Claude Executable Path <span className="optional">(optional)</span></div>
              <input type="text" value={claudeExecutablePath} onChange={(e) => setClaudeExecutablePath(e.target.value)} placeholder="/usr/local/bin/claude" />
            </div>
            <button onClick={startConversation}>Start Conversation</button>
            <div id="startResult" className="json-viewer-container">
              {results.startResult && <JsonViewer data={results.startResult} resultId="startResult" />}
            </div>
          </div>
        </div>
        
        {/* Resume Conversation */}
        <div className="section">
          <div className={`endpoint collapsible ${collapsed.resume ? 'collapsed' : ''}`} onClick={() => toggleCollapse('resume')}>
            POST /api/conversations/resume
          </div>
          <div className="collapsible-content">
            <div className="field-group">
              <div className="field-label">Session ID <span style={{ color: 'red' }}>*</span></div>
              <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} style={{ marginBottom: 5 }}>
                <option value="">Select a session...</option>
                {availableSessions.map(session => {
                  const summary = session.summary || 'No summary';
                  const customName = session.custom_name || '';
                  const displayName = customName ? `[${customName}] ${summary}` : summary;
                  const date = new Date(session.updatedAt).toLocaleString();
                  const metrics = session.toolMetrics;
                  const metricsStr = metrics ? ` [📝${metrics.editCount} ✏️${metrics.writeCount} +${metrics.linesAdded} -${metrics.linesRemoved}]` : '';
                  return (
                    <option key={session.sessionId} value={session.sessionId} title={`${session.sessionId}\n${customName ? `Custom Name: ${customName}\n` : ''}${summary}\nPath: ${session.projectPath}\nUpdated: ${date}${metrics ? `\n\nTool Metrics:\nEdits: ${metrics.editCount}\nWrites: ${metrics.writeCount}\nLines Added: ${metrics.linesAdded}\nLines Removed: ${metrics.linesRemoved}` : ''}`}>
                      {session.sessionId.substring(0, 8)}... - {displayName.substring(0, 50)}...{metricsStr} ({date})
                    </option>
                  );
                })}
              </select>
              <input type="text" value={sessionId} onChange={(e) => setSessionId(e.target.value)} placeholder="claude-session-id or select from dropdown" />
            </div>
            <div className="field-group">
              <div className="field-label">Message <span style={{ color: 'red' }}>*</span></div>
              <input type="text" value={resumeMessage} onChange={(e) => setResumeMessage(e.target.value)} placeholder="Continue with this message..." />
            </div>
            <button onClick={resumeConversation}>Resume Conversation</button>
            <div id="resumeResult" className="json-viewer-container">
              {results.resumeResult && <JsonViewer data={results.resumeResult} resultId="resumeResult" />}
            </div>
          </div>
        </div>
        
        {/* Stop Conversation */}
        <div className="section">
          <div className={`endpoint collapsible ${collapsed.stop ? 'collapsed' : ''}`} onClick={() => toggleCollapse('stop')}>
            POST /api/conversations/:streamingId/stop
          </div>
          <div className="collapsible-content">
            <div className="field-group">
              <div className="field-label">Streaming ID <span style={{ color: 'red' }}>*</span></div>
              <input type="text" value={stopStreamingId} onChange={(e) => setStopStreamingId(e.target.value)} placeholder="streaming-id" />
            </div>
            <button onClick={stopConversation}>Stop Conversation</button>
            <div id="stopResult" className="json-viewer-container">
              {results.stopResult && <JsonViewer data={results.stopResult} resultId="stopResult" />}
            </div>
          </div>
        </div>
        
        {/* List Conversations */}
        <div className="section">
          <div className={`endpoint collapsible ${collapsed.list ? 'collapsed' : ''}`} onClick={() => toggleCollapse('list')}>
            GET /api/conversations
          </div>
          <div className="collapsible-content">
            <div className="field-group">
              <div className="inline-fields">
                <div>
                  <div className="field-label">Limit <span className="optional">(optional)</span></div>
                  <input type="number" value={sidebarConversationsLimit} onChange={(e) => setSidebarConversationsLimit(e.target.value)} placeholder="20" />
                </div>
                <div>
                  <div className="field-label">Offset <span className="optional">(optional)</span></div>
                  <input type="number" value={sidebarConversationsOffset} onChange={(e) => setSidebarConversationsOffset(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <div className="field-label">Project Path <span className="optional">(optional)</span></div>
                  <input type="text" value={sidebarConversationsProjectPath} onChange={(e) => setSidebarConversationsProjectPath(e.target.value)} placeholder="/path/to/project" />
                </div>
              </div>
            </div>
            <button onClick={listConversationsSidebar}>List Conversations</button>
            <div id="sidebarConversationsResult" className="json-viewer-container">
              {results.sidebarConversationsResult && <JsonViewer data={results.sidebarConversationsResult} resultId="sidebarConversationsResult" />}
            </div>
          </div>
        </div>
        
        {/* Update Session (includes rename) */}
        <div className="section">
          <div className={`endpoint collapsible ${collapsed.rename ? 'collapsed' : ''}`} onClick={() => toggleCollapse('rename')}>
            PUT /api/conversations/:sessionId/update
          </div>
          <div className="collapsible-content">
            <div className="field-group">
              <div className="field-label">Session ID <span style={{ color: 'red' }}>*</span></div>
              <select value={renameSessionId} onChange={(e) => setRenameSessionId(e.target.value)} style={{ marginBottom: 5 }}>
                <option value="">Select a session...</option>
                {availableSessions.map(session => {
                  const summary = session.summary || 'No summary';
                  const customName = session.custom_name || '';
                  const displayName = customName ? `[${customName}] ${summary}` : summary;
                  const date = new Date(session.updatedAt).toLocaleString();
                  const metrics = session.toolMetrics;
                  const metricsStr = metrics ? ` [📝${metrics.editCount} ✏️${metrics.writeCount} +${metrics.linesAdded} -${metrics.linesRemoved}]` : '';
                  return (
                    <option key={session.sessionId} value={session.sessionId} title={`${session.sessionId}\n${customName ? `Custom Name: ${customName}\n` : ''}${summary}\nPath: ${session.projectPath}\nUpdated: ${date}${metrics ? `\n\nTool Metrics:\nEdits: ${metrics.editCount}\nWrites: ${metrics.writeCount}\nLines Added: ${metrics.linesAdded}\nLines Removed: ${metrics.linesRemoved}` : ''}`}>
                      {session.sessionId.substring(0, 8)}... - {displayName.substring(0, 50)}...{metricsStr} ({date})
                    </option>
                  );
                })}
              </select>
              <input type="text" value={renameSessionId} onChange={(e) => setRenameSessionId(e.target.value)} placeholder="claude-session-id or select from dropdown" />
            </div>
            <div className="field-group">
              <div className="field-label">Custom Name <span className="optional">(empty to clear)</span></div>
              <input type="text" value={renameCustomName} onChange={(e) => setRenameCustomName(e.target.value)} placeholder="My Project Discussion" maxLength={200} />
              <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                {renameCustomName.length}/200 characters
              </div>
            </div>
            <div className="field-group">
              <div className="inline-fields">
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
            <div className="field-group">
              <div className="field-label">Continuation Session ID <span className="optional">(optional)</span></div>
              <input type="text" value={continuationSessionId} onChange={(e) => setContinuationSessionId(e.target.value)} placeholder="claude-session-id" />
            </div>
            <div className="field-group">
              <div className="field-label">Initial Commit HEAD <span className="optional">(optional)</span></div>
              <input type="text" value={initialCommitHead} onChange={(e) => setInitialCommitHead(e.target.value)} placeholder="git commit hash" />
            </div>
            <button onClick={renameSession}>Update Session</button>
            <div id="renameResult" className="json-viewer-container">
              {results.renameResult && <JsonViewer data={results.renameResult} resultId="renameResult" />}
            </div>
          </div>
        </div>
        
        {/* List Permissions */}
        <div className="section">
          <div className={`endpoint collapsible ${collapsed.permissions ? 'collapsed' : ''}`} onClick={() => toggleCollapse('permissions')}>
            GET /api/permissions
          </div>
          <div className="collapsible-content">
            <div className="field-group">
              <div className="inline-fields">
                <div>
                  <div className="field-label">Streaming ID <span className="optional">(optional)</span></div>
                  <input type="text" value={permissionsStreamingId} onChange={(e) => setPermissionsStreamingId(e.target.value)} placeholder="streaming-id" />
                </div>
                <div>
                  <div className="field-label">Status <span className="optional">(optional)</span></div>
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
            <div id="permissionsResult" className="json-viewer-container">
              {results.permissionsResult && <JsonViewer data={results.permissionsResult} resultId="permissionsResult" />}
            </div>
          </div>
        </div>
        
        {/* Permission Decision */}
        <div className="section">
          <div className={`endpoint collapsible ${collapsed.permissionDecision ? 'collapsed' : ''}`} onClick={() => toggleCollapse('permissionDecision')}>
            POST /api/permissions/:requestId/decision
          </div>
          <div className="collapsible-content">
            <div className="field-group">
              <div className="field-label">Request ID <span style={{ color: 'red' }}>*</span></div>
              <input type="text" value={permissionRequestId} onChange={(e) => setPermissionRequestId(e.target.value)} placeholder="permission-request-id" />
            </div>
            <div className="field-group">
              <div className="field-label">Request Body <span style={{ color: 'red' }}>*</span></div>
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
            <div id="permissionDecisionResult" className="json-viewer-container">
              {results.permissionDecisionResult && <JsonViewer data={results.permissionDecisionResult} resultId="permissionDecisionResult" />}
            </div>
          </div>
        </div>

        {/* List Directory */}
        <div className="section">
          <div className={`endpoint collapsible ${collapsed.listDir ? 'collapsed' : ''}`} onClick={() => toggleCollapse('listDir')}>
            GET /api/filesystem/list
          </div>
          <div className="collapsible-content">
            <div className="field-group">
              <div className="field-label">Path <span style={{ color: 'red' }}>*</span></div>
              <input type="text" value={listPath} onChange={(e) => setListPath(e.target.value)} placeholder="/absolute/path/to/directory" />
            </div>
            <div className="field-group">
              <div className="inline-fields">
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
            <div id="listResult" className="json-viewer-container">
              {results.listResult && <JsonViewer data={results.listResult} resultId="listResult" />}
            </div>
          </div>
        </div>

        {/* Read File */}
        <div className="section">
          <div className={`endpoint collapsible ${collapsed.readFile ? 'collapsed' : ''}`} onClick={() => toggleCollapse('readFile')}>
            GET /api/filesystem/read
          </div>
          <div className="collapsible-content">
            <div className="field-group">
              <div className="field-label">Path <span style={{ color: 'red' }}>*</span></div>
              <input type="text" value={readPath} onChange={(e) => setReadPath(e.target.value)} placeholder="/absolute/path/to/file.txt" />
            </div>
            <button onClick={readFile}>Read File</button>
            <div id="readResult" className="json-viewer-container">
              {results.readResult && <JsonViewer data={results.readResult} resultId="readResult" />}
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="main">
        <div className="main-content">
          {/* Get Conversation Details */}
          <div className="section">
          <div className="endpoint">GET /api/conversations/:sessionId</div>
          <div className="field-group">
            <div className="field-label">Session ID <span style={{ color: 'red' }}>*</span></div>
            <select value={detailSessionId} onChange={(e) => setDetailSessionId(e.target.value)} style={{ marginBottom: 5 }}>
              <option value="">Select a session...</option>
              {availableSessions.map(session => {
                const summary = session.summary || 'No summary';
                const customName = session.custom_name || '';
                const displayName = customName ? `[${customName}] ${summary}` : summary;
                const date = new Date(session.updatedAt).toLocaleString();
                const metrics = session.toolMetrics;
                const metricsStr = metrics ? ` [📝${metrics.editCount} ✏️${metrics.writeCount} +${metrics.linesAdded} -${metrics.linesRemoved}]` : '';
                return (
                  <option key={session.sessionId} value={session.sessionId} title={`${session.sessionId}\n${customName ? `Custom Name: ${customName}\n` : ''}${summary}\nPath: ${session.projectPath}\nUpdated: ${date}${metrics ? `\n\nTool Metrics:\nEdits: ${metrics.editCount}\nWrites: ${metrics.writeCount}\nLines Added: ${metrics.linesAdded}\nLines Removed: ${metrics.linesRemoved}` : ''}`}>
                    {session.sessionId.substring(0, 8)}... - {displayName.substring(0, 50)}...{metricsStr} ({date})
                  </option>
                );
              })}
            </select>
            <input type="text" value={detailSessionId} onChange={(e) => setDetailSessionId(e.target.value)} placeholder="claude-session-id or select from dropdown" />
          </div>
          <button onClick={getConversationDetails}>Get Details</button>
          <div id="detailsResult" className="json-viewer-container">
            {results.detailsResult && <JsonViewer data={results.detailsResult} resultId="detailsResult" />}
          </div>
        </div>
        
        {/* Stream */}
        <div className="section">
          <div className="endpoint">GET /api/stream/:streamingId</div>
          <div className="field-group">
            <div className="field-label">Streaming ID <span style={{ color: 'red' }}>*</span></div>
            <input type="text" value={streamingId} onChange={(e) => setStreamingId(e.target.value)} placeholder="streaming-id" />
          </div>
          <button onClick={() => startStream()}>Start Stream</button>
          <button onClick={stopStream}>Stop Stream</button>
          <button onClick={clearStream}>Clear</button>
          <button onClick={(e) => copyStreamToClipboard(e.currentTarget)}>Copy Stream</button>
          <div id="streamResult" className="stream-container" ref={streamResultRef}>
            {streamResult}
          </div>
        </div>
        </div>
        <LogWindow 
          isVisible={logWindowVisible}
          onToggle={() => setLogWindowVisible(!logWindowVisible)}
        />
      </div>
    </div>
  );
}

export default ConsoleApp;