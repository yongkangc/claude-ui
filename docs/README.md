<div align="center" style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 40px;">
  <svg width="48" height="48" viewBox="4.5 5.2 11.7 13.3" fill="currentColor">
    <circle cx="10.3613" cy="6.44531" r="1.03516" />
    <circle cx="5.69336" cy="9.15039" r="1.03516" />
    <circle cx="15.0195" cy="9.15039" r="1.03516" />
    <circle cx="5.69336" cy="14.5801" r="1.03516" />
    <circle cx="15.0195" cy="14.5801" r="1.03516" />
    <circle cx="10.3613" cy="17.2754" r="1.03516" />
    <path d="M10.3613 13.4961C11.2695 13.4961 11.9922 12.7734 11.9922 11.8652C11.9922 10.9668 11.25 10.2344 10.3613 10.2344C9.47266 10.2344 8.73047 10.9766 8.73047 11.8652C8.73047 12.7539 9.46289 13.4961 10.3613 13.4961Z" />
  </svg>
  <span style="font-size: 48px; font-weight: 600; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">cui</span>
</div>

# cui: Claude Code Web UI

[![npm version](https://badge.fury.io/js/cui-server.svg)](https://www.npmjs.com/package/cui-server)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Built with React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![CI](https://github.com/BMPixel/cui/actions/workflows/ci.yml/badge.svg)](https://github.com/BMPixel/cui/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/BMPixel/cui/branch/main/graph/badge.svg)](https://codecov.io/gh/BMPixel/cui)
[![Tests](https://img.shields.io/github/actions/workflow/status/BMPixel/cui/ci.yml?branch=main&label=tests)](https://github.com/BMPixel/cui/actions/workflows/ci.yml)

A web UI for agents powered by [Claude Code](https://claude.ai/code). Start the server and access claude code anywhere in your browser.

<div align="center">
  <img src="assets/demo.gif" alt="Demo" width="100%">
</div>

## Highlights

- Access all your conversations and fork/resume/archive them
- Polished, responsive UI that works anywhere
- Stream multiple sessions simultaneously
- Auto-completion for commands (/) and files (@)
- Built-in Permission Mode with real-time permission granting
- View code diff tracking in the UI

## Getting Started

Make sure you have logged into Claude Code or have a valid Anthropic API key.

Start the server:

```bash
npx cui-server
```

Open http://localhost:3001#/your-token in your browser (replace `your-token` with your actual session token).

## Usage

### Starting a Conversation

1. Click "New Conversation" on the home page
2. Type your message and press Enter
3. Approve or deny tool permissions as they appear
4. View past conversations from the home page

### Configuration

All configuration and data are stored in `~/.cui/`:
- `config.json` - Server settings
- `session-info.json` - Session metadata  
- `preferences.json` - User preferences

## Contributing

Please make sure you (or your fellow AI) have read [CONTRIBUTING.md](CONTRIBUTING.md) before contributing.