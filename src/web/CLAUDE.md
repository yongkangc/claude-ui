# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Web UI Overview

CCUI's web interface is a modern React application providing a chat interface for Claude CLI interactions. It features real-time streaming, conversation management, and a minimalist TUI-inspired design.

## Development Commands

```bash
# Start Vite dev server (port 3000) with hot module replacement
npm run dev:web

# Build production bundle to dist/
npm run build:web

# Full development environment (backend + Vite)
npm run dev:vite
```

## Architecture

### Component Organization

The web UI follows a **feature-based structure** with clear separation:

```
src/web/
├── chat/                  # Main chat interface (production)
│   ├── components/        # UI components with CSS modules
│   ├── hooks/            # Custom React hooks
│   ├── services/         # API integration
│   └── styles/           # Global styles and theme
└── console/              # Legacy console interface (debugging)
```

### Key Architectural Patterns

**Component Pattern:**
- Functional components with TypeScript interfaces
- CSS Modules for scoped styling (`Component.module.css`)
- Props interfaces defined inline or in `types/`
- No class components or higher-order components

**State Management:**
- Local component state via `useState`
- No global state management library
- Custom hooks for reusable stateful logic
- Props drilling for shared state (intentionally simple)

**API Integration:**
- Centralized API client in `chat/services/api.ts`
- Type-safe requests using backend types from `@/types`
- Consistent error handling and logging
- Base URL configured for `/api` endpoints

**Streaming Architecture:**
- Custom `useStreaming` hook manages Server-Sent Events
- Parses newline-delimited JSON (not standard SSE)
- Handles connection lifecycle and cleanup
- Automatic reconnection on failure

### Recent UI Enhancements

**Sidechain Message Hiding:**
- Automatically filters out sidechain messages from the chat interface
- Improves readability by showing only primary conversation flow
- Reduces visual clutter from system-level tool interactions
- Maintains clean conversation history focused on user-assistant dialogue

**Auto-Connect to Ongoing Conversations:**
- Automatically detects and connects to active conversation streams when navigating
- Seamlessly continues showing live updates without manual reconnection
- Enhances user experience by maintaining real-time connection state
- Prevents missing messages when switching between ongoing conversations

**Working Directory Auto-Population:**
- Intelligently pre-fills working directory field with most recently used project path
- Reads from conversation history to determine last active directory
- Reduces repetitive input for users working in the same project
- Falls back to empty field when no recent directory is available

### Critical Implementation Details

**Theme System:**
- CSS custom properties in `:root` and `[data-theme="dark"]`
- `useTheme` hook manages theme state and persistence
- System preference detection with manual override
- Smooth transitions between themes

**Routing:**
- React Router v6 with type-safe routes
- Main routes: `/` (home), `/new` (new conversation), `/chat/:streamingId`
- Navigation state managed by router

**Content Rendering:**
- Message content uses "blocks" pattern from Claude API
- Supports text, code, tool use, and thinking blocks
- Special handling for streaming partial content
- JSON viewer for raw message inspection

**Error Boundaries:**
- API errors displayed in UI with user-friendly messages
- Streaming failures handled gracefully with retry
- Form validation prevents invalid submissions

### Development Practices

**TypeScript Usage:**
- Strict mode enabled
- Avoid `any` types
- Use discriminated unions for message types
- Leverage type inference where possible

**Component Guidelines:**
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks
- Use CSS Modules for all component styles
- Avoid inline styles except for dynamic values

**Performance Considerations:**
- Key prop usage for list rendering
- Memoization only when measurably beneficial
- Efficient event handlers (avoid creating in render)
- Minimize re-renders with proper state structure

### Important Files

**Entry Points:**
- `main.tsx` - React app bootstrap and root render
- `App.tsx` - Router configuration
- `chat/ChatApp.tsx` - Chat interface root

**Core Components:**
- `chat/components/ConversationView/` - Main chat UI with streaming
- `chat/components/MessageList/` - Message rendering logic
- `chat/hooks/useStreaming.ts` - SSE connection management

**Configuration:**
- `vite.config.ts` - Build configuration (in parent directory)
- `tsconfig.web.json` - TypeScript config for web code

### Common Tasks

**Adding a New Component:**
1. Create directory in `components/`
2. Add `ComponentName.tsx` and `ComponentName.module.css`
3. Export from component file
4. Follow existing prop interface patterns

**Modifying API Calls:**
1. Update `chat/services/api.ts`
2. Ensure types match backend in `@/types`
3. Handle errors consistently
4. Add console logging for debugging

**Updating Styles:**
1. Prefer CSS custom properties for theme values
2. Use semantic color names (e.g., `--color-text-primary`)
3. Follow existing spacing scale
4. Maintain mobile-first approach

### Testing Approach

Currently, the web UI lacks automated tests. When adding tests:
- Use Jest + React Testing Library (if configured)
- Focus on user interactions over implementation
- Mock API calls at service boundary
- Test hooks separately from components

### Known Limitations

- No WebSocket support (uses Server-Sent Events)
- No global state management (intentional for simplicity)
- Limited accessibility features
- No internationalization support
- Console app is legacy code (minimal maintenance)

### Integration with Backend

The web UI integrates tightly with the Express backend:
- Vite dev server proxies API calls to backend port
- Production build served statically by Express
- Shared TypeScript types ensure contract
- Streaming endpoints use custom JSONL format