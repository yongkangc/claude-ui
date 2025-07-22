# Permission Decision API Implementation Plan

## Context

Currently, the CCUI system has a permission request flow where:
1. Claude CLI requests permission to use tools through MCP (Model Context Protocol)
2. The MCP server notifies the CCUI backend about the permission request
3. The backend tracks the request and broadcasts it to the frontend via streaming
4. The frontend displays the permission request with Approve/Deny buttons
5. **Problem**: The buttons are currently disabled and the MCP server auto-approves all requests

This plan addresses the missing functionality to allow users to make permission decisions and have those decisions flow back to Claude CLI through the MCP server.

### Current System Flow
```
Claude CLI → MCP Server → CCUI Backend → Frontend (displays request)
                ↓
         (auto-approves)
```

### Desired System Flow
```
Claude CLI → MCP Server → CCUI Backend → Frontend (displays request)
                ↑              ↓               ↓
                └──────────────┴───────── User Decision
```

Important Note: MCP only communicates with the backend through the Rest API. The mcp is a separate process that is called by the Claude CLI. So although we can import PermissionTracker to access the singleton instance, that does not work. MCP server work on its own to only rely on the Rest API.

## Plan: Implement Permission Decision API with Fast Response

### Overview
Add functionality to allow the frontend to send permission decisions (approve/deny) back to the MCP server with sub-second latency, using event-driven architecture instead of polling.

### Key Requirements
- No integration tests for now
- 10-minute timeout for permission decisions
- 1 second latency from user decision to MCP response

### Architecture Changes

1. **MCP Server Pooling Waiting** (in src/mcp-server/index.ts)
   - MCP server notify the backend with the request(already implemented)
   - MCP server poll `/api/permissions` once per second with its own streamingId.
   - 10-minute timeout to prevent indefinite blocking
   - MCP server check status of its own request until it is decided or timed out.

2. **New API Endpoint for Permission Decision** (/api/permissions/:requestId/decision)
   - Used by the client
   - Only update the status of the request on the backend. MCP server poll it own its own.

3. **Frontend Integration** (in src/web/chat/components/InputArea/InputArea.tsx)
   - Enable approve/deny buttons
   - Send decision to `/api/permissions/:requestId/decision`
   - Clear permission UI immediately

### Implementation Steps

1. **Update MCP Server** (`src/mcp-server/index.ts`)
   - Replace auto-approval with polling
   - Return MCP response based on decision

2. **Add Permission Decision Endpoint** (`src/routes/permission.routes.ts`)
   - Add `POST /api/permissions/:requestId/decision`
   - Validate request exists and is pending
   - Update the status of the request on the backend. MCP server poll it own its own.
   - Return success response

4. **Update Frontend API Client** (`src/web/chat/services/api.ts`)
   - Add `sendPermissionDecision()` method
   - Include request ID, action (approve/deny), and optional modified input

5. **Enable Frontend Buttons** (`src/web/chat/components/InputArea/InputArea.tsx`)
   - Remove `disabled` attribute from buttons
   - Add onClick handlers for approve/deny
   - Call API and clear permission request from UI
   - Handle loading state during API call

6. **Update Types** (`src/types/index.ts`)
   - Add `PermissionDecisionRequest` interface
   - Add `PermissionDecisionResponse` interface

7. **Add Unit Tests Only**

8. **Update Documentation**
   - Update API.md with new endpoint
   - Update CLAUDE.md permission flow

### Related Files

1. `src/mcp-server/index.ts` - Use polling waiting
2. `src/routes/permission.routes.ts` - Add decision endpoint
3. `src/types/index.ts` - Add new types
4. `src/web/chat/services/api.ts` - Add API method
5. `src/web/chat/components/InputArea/InputArea.tsx` - Enable buttons
6. `cc-workfiles/knowledge/API.md` - Document endpoint
7. `CLAUDE.md` - Update permission flow

### Performance Considerations

- No polling overhead on server
- Direct memory-based event emission

### API Endpoint Specification

```typescript
// POST /api/permissions/:requestId/decision
interface PermissionDecisionRequest {
  action: 'approve' | 'deny';
  modifiedInput?: Record<string, any>; // Optional: modified tool parameters
  denyReason?: string; // Optional: reason for denial
}

interface PermissionDecisionResponse {
  success: boolean;
  message?: string;
}
```
