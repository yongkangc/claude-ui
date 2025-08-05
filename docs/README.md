<div align="center" style="margin-bottom: 40px;">
  <img src="assets/logo.png" alt="cui logo" width="150">
</div>

# cui: Claude Code Web UI

[![npm version](https://badge.fury.io/js/cui-server.svg)](https://www.npmjs.com/package/cui-server)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Built with React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![codecov](https://codecov.io/gh/BMPixel/cui/branch/main/graph/badge.svg)](https://codecov.io/gh/BMPixel/cui)
[![CI](https://github.com/BMPixel/cui/actions/workflows/ci.yml/badge.svg)](https://github.com/BMPixel/cui/actions/workflows/ci.yml)

A modern web UI for [Claude Code](https://claude.ai/code) agents. Start the server and access Claude Code anywhere in your browser.

<div align="center">
  <img src="assets/demo.gif" alt="Demo" width="100%">
</div>

## Highlights

- **Modern Design**: Polished, responsive UI that works anywhere
- **Parallel Background Agents**: Stream multiple sessions simultaneously
- **Manage Tasks**: Access all your conversations and fork/resume/archive them
- **Claude Code Parity**: Familiar autocompletion and interaction with CLI
- **Push Notifications**: Get notified when your agents are finished
- **Dictation**: Precise dictation powered by Gemini 2.5 Flash

## Getting Started

1. Ensure you're logged into Claude Code or have a valid Anthropic API key.

2. With Node.js >= 20.19.0, start the server:

    ```bash
    npx cui-server
    ```
    or install it globally:
    ```bash
    npm install -g cui-server
    ```

3. Open http://localhost:3001/#your-token in your browser (the token will be displayed in the cui-server command output).
4. (Optional) Configure the settings for notifications and dictation.

## Usage

### Tasks

- **Start a New Task**

  cui automatically scans your existing Claude Code history in `~/.claude/` and displays it on the home page, allowing you to resume any of your previous tasks. The dropdown menu in the input area shows all your previous working directories.

- **Fork a Task**

  To create a branch from an existing task (only supported for tasks started from cui), navigate to the "History" tab on the home page, find the session you want to fork, and resume it with new messages.

- **Manage Tasks**

  Feel free to close the page after starting a task—it will continue running in the background. When running multiple tasks (started from cui), you can check their status in the "Tasks" tab. You can also archive tasks by clicking the "Archive" button. Archived tasks remain accessible in the "Archived" tab.

- **Tmux Integration (Default)**

  cui automatically runs all Claude sessions within tmux for maximum persistence and accessibility:
  - **Intelligent Session Naming**: Sessions are automatically named based on your working directory (e.g., working in `/path/to/bifrost` creates session `cui-bifrost`)
  - **Smart Session Reuse**: Automatically reuses existing tmux sessions when possible, or creates new windows in existing sessions
  - **Conflict Resolution**: If a session exists with active Claude processes, creates numbered variants (e.g., `cui-bifrost-1`)
  - **Persistent Sessions**: Continue conversations even if the CUI server restarts
  - **Direct Terminal Access**: Attach to running Claude sessions directly via `tmux attach -t cui-bifrost`
  - **SSH Resilience**: Sessions persist across SSH disconnections
  
  Tmux sessions are automatically managed - no configuration required. To disable tmux for a specific conversation, set `useTmux: false`.

### Dictation

cui uses [Gemini 2.5 Flash](https://deepmind.google/models/gemini/flash/) to provide highly accurate dictation, particularly effective for long sentences. To enable this feature, you'll need a [Gemini API key](https://aistudio.google.com/apikey) with generous free-tier usage. Set the `GOOGLE_API_KEY` environment variable before starting the server. Note that using this feature will share your audio data with Google.

### Notifications

You can receive push notifications when your task is finished or when Claude is waiting for your permission to use tools. Notifications are sent using [ntfy](https://ntfy.sh/). To receive them, install ntfy on any of your devices and subscribe to the topic (see settings).

### Keyboard Shortcuts

More keyboard shortcuts are coming. Currently available:

- `Enter`: Enter a new line
- `Command/Ctrl + Enter`: Send message
- `/`: List all commands
- `@`: List all files in the current working directory

All inline syntaxes like `/init` or `@file.txt` are supported just like in the CLI.

### Remote Access

#### Option 1: Direct Network Access

1. Open `~/.cui/config.json` to set the `server.host` (0.0.0.0) and `server.port`. Alternatively, you can use `--host` and `--port` flags when starting the server.
2. Ensure you use a secure auth token if accessing the server from outside your local network. The auth token is generated when you start the server and can be changed in the `~/.cui/config.json` file.
3. Recommended: Use HTTPS to access the server. You can use a reverse proxy like [Caddy](https://caddyserver.com/) to set this up. On iOS, the dictation feature is only available when using HTTPS.

#### Option 2: Cloudflare Tunnel (Recommended)

Cloudflare Tunnel provides secure, encrypted access to your CUI instance without opening firewall ports or configuring complex networking.

**Prerequisites:**
- A Cloudflare account (free tier works)
- A domain added to Cloudflare
- `cloudflared` installed on your server

**Setup Steps:**

1. **Install cloudflared** (if not already installed):
   ```bash
   # On Linux/macOS
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared.deb
   ```

2. **Authenticate with Cloudflare:**
   ```bash
   cloudflared tunnel login
   ```
   This opens a browser window to authorize cloudflared with your Cloudflare account.

3. **Create a tunnel:**
   ```bash
   cloudflared tunnel create cui
   ```
   Note the tunnel ID that's generated.

4. **Configure the tunnel:**
   Create `/etc/cloudflared/config.yml`:
   ```yaml
   tunnel: <your-tunnel-id>
   credentials-file: /etc/cloudflared/<your-tunnel-id>.json
   
   ingress:
     - hostname: cui.your-domain.com
       service: http://localhost:3001
     - service: http_status:404
   ```

5. **Set up DNS routing:**
   ```bash
   cloudflared tunnel route dns <tunnel-id> cui.your-domain.com
   ```

6. **Install and start the tunnel service:**
   ```bash
   sudo cloudflared service install
   sudo systemctl enable cloudflared
   sudo systemctl start cloudflared
   ```

7. **Access your CUI instance:**
   Visit `https://cui.your-domain.com#token=your-auth-token`

**Benefits of Cloudflare Tunnel:**
- ✅ No firewall configuration needed
- ✅ Automatic HTTPS with Cloudflare's certificates
- ✅ DDoS protection and caching
- ✅ Works from anywhere with internet access
- ✅ Built-in access controls and security features

### Configuration

All configuration and data are stored in `~/.cui/`.

- `config.json` - Server settings
- `session-info.json` - Session metadata
- `preferences.json` - User preferences

To uninstall cui, simply delete the `~/.cui/` directory and remove the package with `npm uninstall -g cui-server`.

## Contributing

The best way to contribute is to suggest improvements or report bugs in the [issues](https://github.com/BMPixel/cui/issues) and give us a star ⭐!

Before submitting a PR, please make sure you (or your fellow AI) have read [CONTRIBUTING.md](CONTRIBUTING.md).
