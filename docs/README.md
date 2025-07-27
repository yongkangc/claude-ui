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