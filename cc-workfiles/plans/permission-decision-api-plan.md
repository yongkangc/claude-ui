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

## Plan: Implement Permission Decision API with Fast Response

### Overview
Add functionality to allow the frontend to send permission decisions (approve/deny) back to the MCP server with sub-second latency, using event-driven architecture instead of polling.

### Key Requirements
- No integration tests for now
- 10-minute timeout for permission decisions
- < 1 second latency from user decision to MCP response

### Architecture Changes

1. **MCP Server Event-Driven Waiting**
   - MCP server creates a promise that waits for permission decision
   - Uses event emitter pattern to receive instant notification
   - 10-minute timeout to prevent indefinite blocking
   - Sub-second response time via direct event notification

2. **Backend Permission Decision Flow**
   - Permission decision endpoint updates PermissionTracker
   - PermissionTracker emits event with decision
   - MCP server receives event and resolves waiting promise

3. **Frontend Integration**
   - Enable approve/deny buttons
   - Send decision to backend
   - Clear permission UI immediately

### Implementation Steps

1. **Enhance PermissionTracker** (`src/services/permission-tracker.ts`)
   - Add method to wait for permission decision (returns Promise)
   - Emit specific event when permission is decided
   - Handle cleanup for timed-out requests

2. **Update MCP Server** (`src/mcp-server/index.ts`)
   - Import PermissionTracker to access the singleton instance
   - Replace auto-approval with event-driven waiting
   - Use PermissionTracker's wait method with 10-minute timeout
   - Return MCP response based on decision

3. **Add Permission Decision Endpoint** (`src/routes/permission.routes.ts`)
   - Add `POST /api/permissions/:requestId/decision`
   - Validate request exists and is pending
   - Call PermissionTracker.updatePermissionStatus()
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
   - Test permission decision endpoint
   - Test PermissionTracker wait mechanism
   - Test timeout handling
   - Test event emission

8. **Update Documentation**
   - Update API.md with new endpoint
   - Update CLAUDE.md permission flow

### Event-Driven Design for Sub-Second Response

```typescript
// PermissionTracker adds waiting mechanism:
class PermissionTracker {
  private waitingPromises: Map<string, {
    resolve: (decision: PermissionDecision) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  async waitForDecision(requestId: string, timeoutMs: number): Promise<PermissionDecision> {
    // Create promise that resolves when decision is made
    // Set timeout to reject after 10 minutes
    // Clean up on resolution/timeout
  }

  updatePermissionStatus(id: string, status: 'approved' | 'denied', options?: {...}) {
    // Update status
    // Emit event
    // Resolve any waiting promise
  }
}
```

### Files to Modify

1. `src/services/permission-tracker.ts` - Add event-driven waiting
2. `src/mcp-server/index.ts` - Use event-driven waiting
3. `src/routes/permission.routes.ts` - Add decision endpoint
4. `src/types/index.ts` - Add new types
5. `src/web/chat/services/api.ts` - Add API method
6. `src/web/chat/components/InputArea/InputArea.tsx` - Enable buttons
7. `cc-workfiles/knowledge/API.md` - Document endpoint
8. `CLAUDE.md` - Update permission flow

### Files to Create

1. `tests/unit/routes/permission-decision.test.ts` - Unit tests for decision endpoint
2. `tests/unit/services/permission-tracker-wait.test.ts` - Unit tests for wait mechanism

### Performance Considerations

- Event-driven approach ensures < 1 second response time
- No polling overhead on server
- Direct memory-based event emission
- Automatic cleanup of timed-out requests
- Singleton PermissionTracker ensures events reach MCP server

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

### Testing Strategy

Since integration tests are not required for now, focus on comprehensive unit tests:

1. **PermissionTracker Wait Mechanism**
   - Test promise resolution on decision
   - Test timeout after 10 minutes
   - Test cleanup of waiting promises
   - Test multiple concurrent waits

2. **Permission Decision Endpoint**
   - Test valid decision updates
   - Test invalid request ID handling
   - Test non-pending request rejection
   - Test input validation

3. **MCP Server Decision Handling**
   - Mock PermissionTracker for testing
   - Test approve response format
   - Test deny response format
   - Test timeout response