# CCUI Chat Interface

A modern, minimalistic chat interface for CCUI (Claude Code Web UI) with a TUI-inspired design.

## Features

- **Responsive Design**: Mobile-first approach with a collapsible sidebar
- **Real-time Streaming**: Live updates using Server-Sent Events (SSE)
- **Light/Dark Mode**: System preference detection with manual toggle
- **Conversation Management**: List, start, and resume conversations
- **Syntax Highlighting**: JSON viewer with collapsible sections
- **Keyboard Shortcuts**: Enter to send, Shift+Enter for new line

## Architecture

### Components

- **Layout**: Main container with header and theme toggle
- **Home**: Landing page showing recent conversations
- **ConversationView**: Message display with streaming support
- **MessageList**: Scrollable message container
- **MessageItem**: Individual message rendering with content blocks
- **InputArea**: Multiline input with send functionality
- **JsonViewer**: Syntax-highlighted JSON display

### Hooks

- **useTheme**: Theme management with persistence
- **useStreaming**: SSE connection handling

### Services

- **api**: Centralized API calls with console logging

## Design System

- **Colors**: CSS custom properties for theming
- **Typography**: Monospace font with defined size scale
- **Spacing**: Consistent spacing units
- **Icons**: Lucide React icon library
- **Animations**: Subtle transitions and loading states

## Usage

1. Navigate to `/` to see recent conversations
2. Click on a conversation to view or continue it
3. Messages stream in real-time
4. Continue conversations with the input area

## Development

```bash
# Run development server
npm run dev:vite

# Build for production
npm run build:web
```