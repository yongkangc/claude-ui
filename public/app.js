let currentStream = null;
let availableSessions = [];

// Helper to create/update JSON viewer
function showJson(elementId, data) {
    const container = document.getElementById(elementId);
    
    // Clear existing content
    container.innerHTML = '';
    
    // Create json-viewer element
    const viewer = document.createElement('json-viewer');
    viewer.data = data;
    
    // Expand first level by default
    viewer.expandAll = false;
    viewer.expand('$.*');
    
    container.appendChild(viewer);
}

// Load available sessions on page load
async function loadAvailableSessions() {
    try {
        const response = await fetch('/api/conversations?limit=100&sortBy=updated&order=desc');
        const data = await response.json();
        availableSessions = data.conversations || [];
        updateSessionDropdowns();
    } catch (e) {
        console.error('Failed to load sessions:', e);
    }
}

// Update all session dropdowns
function updateSessionDropdowns() {
    const dropdowns = ['sessionIdDropdown', 'detailSessionIdDropdown'];
    
    dropdowns.forEach(dropdownId => {
        const select = document.getElementById(dropdownId);
        if (!select) return;
        
        // Clear existing options
        select.innerHTML = '<option value="">Select a session...</option>';
        
        // Add sessions as options
        availableSessions.forEach(session => {
            const option = document.createElement('option');
            option.value = session.sessionId;
            const summary = session.summary || 'No summary';
            const date = new Date(session.updatedAt).toLocaleString();
            option.textContent = `${session.sessionId.substring(0, 8)}... - ${summary.substring(0, 50)}... (${date})`;
            option.title = `${session.sessionId}\n${summary}\nPath: ${session.projectPath}\nUpdated: ${date}`;
            select.appendChild(option);
        });
    });
}

// Handle session dropdown changes
function onSessionSelect(inputId, dropdownId) {
    const select = document.getElementById(dropdownId);
    const input = document.getElementById(inputId);
    if (select.value) {
        input.value = select.value;
    }
}

// Toggle collapse function
function toggleCollapse(element) {
    element.classList.toggle('collapsed');
    const content = element.nextElementSibling;
    if (content) {
        if (element.classList.contains('collapsed')) {
            content.style.maxHeight = '0';
        } else {
            content.style.maxHeight = content.scrollHeight + 'px';
        }
    }
}

async function getSystemStatus() {
    try {
        const response = await fetch('/api/system/status');
        const data = await response.json();
        showJson('statusResult', data);
    } catch (e) {
        showJson('statusResult', { error: e.message });
    }
}

async function listConversations() {
    try {
        const params = new URLSearchParams();
        const limit = document.getElementById('conversationsLimit').value;
        const offset = document.getElementById('conversationsOffset').value;
        const projectPath = document.getElementById('conversationsProjectPath').value;
        
        if (limit) params.append('limit', limit);
        if (offset) params.append('offset', offset);
        if (projectPath) params.append('projectPath', projectPath);
        
        // Always sort by newest first
        params.append('sortBy', 'updated');
        params.append('order', 'desc');
        
        const response = await fetch(`/api/conversations?${params}`);
        const data = await response.json();
        showJson('conversationsResult', data);
        
        // Update available sessions for dropdowns
        if (data.conversations) {
            availableSessions = data.conversations;
            updateSessionDropdowns();
        }
    } catch (e) {
        showJson('conversationsResult', { error: e.message });
    }
}

async function startConversation() {
    try {
        const body = {
            workingDirectory: document.getElementById('workingDir').value,
            initialPrompt: document.getElementById('initialPrompt').value
        };
        
        // Add optional fields if provided
        const model = document.getElementById('model').value;
        const systemPrompt = document.getElementById('systemPrompt').value;
        const claudeExecutablePath = document.getElementById('claudeExecutablePath').value;
        
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
        
        // Auto-fill streaming ID and start streaming
        if (data.streamingId) {
            document.getElementById('streamingId').value = data.streamingId;
            document.getElementById('stopStreamingId').value = data.streamingId;
            // Auto-start streaming
            startStream();
            // Refresh session list
            loadAvailableSessions();
        }
    } catch (e) {
        showJson('startResult', { error: e.message });
    }
}

async function resumeConversation() {
    try {
        const response = await fetch('/api/conversations/resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: document.getElementById('sessionId').value,
                message: document.getElementById('resumeMessage').value
            })
        });
        const data = await response.json();
        showJson('resumeResult', data);
        
        // Auto-fill streaming ID and start streaming
        if (data.streamingId) {
            document.getElementById('streamingId').value = data.streamingId;
            document.getElementById('stopStreamingId').value = data.streamingId;
            // Auto-start streaming
            startStream();
            // Refresh session list
            loadAvailableSessions();
        }
    } catch (e) {
        showJson('resumeResult', { error: e.message });
    }
}

async function startStream() {
    const streamingId = document.getElementById('streamingId').value;
    const result = document.getElementById('streamResult');
    
    if (!streamingId) {
        result.innerHTML = '<span style="color: #ff6b6b;">Please enter a streaming ID</span>';
        return;
    }
    
    result.innerHTML = '<span style="color: #51cf66;">Connecting to stream...</span>\n\n';
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    try {
        const response = await fetch(`/api/stream/${streamingId}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        currentStream = reader;
        let buffer = '';
        let lineCount = 0;
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                result.innerHTML += '\n<span style="color: #868e96;">[Stream ended]</span>';
                break;
            }
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            
            for (const line of lines) {
                if (line.trim()) {
                    lineCount++;
                    const lineDiv = document.createElement('div');
                    lineDiv.className = 'stream-line';
                    lineDiv.innerHTML = `<span style="color: #868e96;">${lineCount}:</span> ${escapeHtml(line)}`;
                    result.appendChild(lineDiv);
                    result.scrollTop = result.scrollHeight;
                }
            }
        }
    } catch (e) {
        result.innerHTML += `\n<span style="color: #ff6b6b;">Error: ${e.message}</span>`;
    }
}

function stopStream() {
    if (currentStream) {
        currentStream.cancel();
        currentStream = null;
        document.getElementById('streamResult').innerHTML += '\n<span style="color: #ffd43b;">[Stream stopped by user]</span>';
    }
}

function clearStream() {
    document.getElementById('streamResult').innerHTML = '';
}

async function stopConversation() {
    try {
        const streamingId = document.getElementById('stopStreamingId').value;
        const response = await fetch(`/api/conversations/${streamingId}/stop`, {
            method: 'POST'
        });
        const data = await response.json();
        showJson('stopResult', data);
    } catch (e) {
        showJson('stopResult', { error: e.message });
    }
}

async function getConversationDetails() {
    try {
        const sessionId = document.getElementById('detailSessionId').value;
        const response = await fetch(`/api/conversations/${sessionId}`);
        const data = await response.json();
        showJson('detailsResult', data);
    } catch (e) {
        showJson('detailsResult', { error: e.message });
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function listPermissions() {
    try {
        const params = new URLSearchParams();
        const streamingId = document.getElementById('permissionsStreamingId').value;
        const status = document.getElementById('permissionsStatus').value;
        
        if (streamingId) params.append('streamingId', streamingId);
        if (status) params.append('status', status);
        
        const response = await fetch(`/api/permissions?${params}`);
        const data = await response.json();
        showJson('permissionsResult', data);
    } catch (e) {
        showJson('permissionsResult', { error: e.message });
    }
}

async function listDirectory() {
    try {
        const path = document.getElementById('listPath').value;
        if (!path) {
            showJson('listResult', { error: 'Path is required' });
            return;
        }
        
        const params = new URLSearchParams();
        params.append('path', path);
        
        const response = await fetch(`/api/filesystem/list?${params}`);
        const data = await response.json();
        showJson('listResult', data);
    } catch (e) {
        showJson('listResult', { error: e.message });
    }
}

async function readFile() {
    try {
        const path = document.getElementById('readPath').value;
        if (!path) {
            showJson('readResult', { error: 'Path is required' });
            return;
        }
        
        const params = new URLSearchParams();
        params.append('path', path);
        
        const response = await fetch(`/api/filesystem/read?${params}`);
        const data = await response.json();
        showJson('readResult', data);
    } catch (e) {
        showJson('readResult', { error: e.message });
    }
}

// Initialize collapsible sections to proper max-height
window.addEventListener('DOMContentLoaded', () => {
    loadAvailableSessions();
    
    const collapsibles = document.querySelectorAll('.collapsible-content');
    collapsibles.forEach(content => {
        const isCollapsed = content.previousElementSibling.classList.contains('collapsed');
        if (isCollapsed) {
            content.style.maxHeight = '0';
        } else {
            content.style.maxHeight = content.scrollHeight + 'px';
        }
    });
});