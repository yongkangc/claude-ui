# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CCUI (Claude Code Web UI) is a web interface for the Claude CLI tool. It consists of:
- TypeScript Express backend that manages Claude CLI processes
- React frontend with TUI-inspired design
- Single-port architecture using vite-express (port 3001)
- Real-time streaming of Claude responses via newline-delimited JSON
- MCP (Model Context Protocol) integration for permission management

## Essential Commands

### Development
```bash
npm run dev          # Start dev server (backend + frontend on port 3001)
npm run build        # Build both frontend and backend
npm run test         # Run all tests
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint checking
```

### Testing
```bash
npm run test                # Run all tests
npm run unit-tests          # Run unit tests only
npm run integration-tests   # Run integration tests only
npm run test:coverage       # Generate coverage report
npm run test:watch          # Watch mode for TDD
```

### Running a Single Test
```bash
npx jest tests/unit/services/ClaudeProcessManager.test.ts  # Run specific test file
npx jest -t "test name"                                    # Run test by name pattern
```

## Architecture Overview

### Backend Services (`src/services/`)
- **ClaudeProcessManager**: Spawns and manages Claude CLI processes
- **StreamManager**: Handles HTTP streaming connections for real-time updates
- **ClaudeHistoryReader**: Reads conversation history from ~/.claude directory
- **CCUIMCPServer**: MCP server for handling tool permission requests
- **SessionInfoService**: Manages extended session metadata (pinning, archiving, continuation sessions, git HEAD tracking)

### Frontend (`src/web/`)
- **chat/**: Main chat application components
- **console/**: Console/log viewer components  
- **api/**: API client using fetch for backend communication
- **styles/**: CSS modules with TUI-inspired design

### API Routes (`src/routes/`)
- Conversations API: Start, list, get, continue, stop conversations
- Streaming API: Real-time conversation updates
- Permissions API: MCP permission approval/denial
- System API: Status and available models

### Key Patterns

1. **Streaming Architecture**: Uses newline-delimited JSON (not SSE) for real-time updates
2. **Process Management**: Each conversation runs as a separate Claude CLI child process
3. **Error Handling**: Custom error types in `src/types/errors.ts` with proper HTTP status codes
4. **Type Safety**: Zod schemas for runtime validation, TypeScript interfaces for compile-time safety
5. **Testing**: Comprehensive unit and integration tests with mocks for external dependencies

### Important Implementation Notes

- When modifying streaming logic, ensure proper cleanup of event listeners
- MCP permission requests must be handled synchronously to avoid blocking Claude
- Process spawn arguments are built dynamically based on conversation options
- Frontend uses React Router v6 for navigation
- All backend imports use path aliases (e.g., `@/services/...`)

### Permission Flow

1. **Permission Request**: When Claude needs tool approval, the MCP server sends a notification to `/api/permissions/notify`
2. **Frontend Display**: Permission requests are streamed to the frontend and displayed with approve/deny buttons
3. **User Decision**: Users click approve/deny, which calls `/api/permissions/:requestId/decision`
4. **MCP Polling**: The MCP server polls for decisions every second with a 10-minute timeout
5. **Response**: Once a decision is made, the MCP server returns the appropriate response to Claude

### Common Debugging

- Enable debug logs: `LOG_LEVEL=debug npm run dev`
- Test logs are silenced by default, use `npm run test:debug` for verbose output
- Check `~/.ccui/config.json` for server configuration
- MCP configuration is in `config/mcp-config.json`

## Session Information

The SessionInfoService manages extended metadata for conversation sessions. This information is now included as a complete `sessionInfo` object in ConversationSummary responses:

- **custom_name**: User-provided name for the session (default: "")
- **pinned**: Boolean flag for pinning important sessions (default: false)
- **archived**: Boolean flag for archiving old sessions (default: false) 
- **continuation_session_id**: Links to a continuation session if the conversation continues elsewhere (default: "")
- **initial_commit_head**: Git commit HEAD when the session started for tracking code changes (default: "")
- **created_at**: ISO 8601 timestamp when session info was created
- **updated_at**: ISO 8601 timestamp when session info was last updated
- **version**: Schema version for future migrations

Sessions are automatically migrated to include these fields when the schema version updates. All ConversationSummary objects now include the complete sessionInfo instead of just the custom_name field.

## Development Gotchas

- Do not run npm run dev to verify frontend update
- Before running test for the first time, run `npm run build` to build the backend and frontend, especially it build the mcp executable. Other wise the test will fail with Error: MCP tool mcp__ccui-permissions__approval_prompt (passed via --permission-prompt-tool) not found.