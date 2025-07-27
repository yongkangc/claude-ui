# CUI

A web UI for agents powered by [Claude Code](https://claude.ai/code).

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