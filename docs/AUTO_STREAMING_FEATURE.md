# Auto-Streaming Feature for Ongoing Conversations

## Overview

This feature enables the CCUI web interface to automatically connect to existing streaming connections when opening conversations that have an active streaming process.

## Use Case

When users have multiple browser tabs or devices accessing CCUI:
1. User starts a conversation in Tab A - Claude begins processing
2. User opens the same conversation in Tab B while it's still processing
3. Tab B automatically connects to the existing stream and shows real-time updates

## Implementation Details

### Frontend Changes

**File Modified:** `src/web/chat/components/ConversationView/ConversationView.tsx`

The component now:
1. Loads conversation history as before
2. Fetches the conversation list to check the current status
3. If the conversation has `status: 'ongoing'` and a `streamingId`, automatically connects to that stream

```typescript
// After loading conversation details
const conversationsResponse = await api.getConversations({ limit: 100 });
const currentConversation = conversationsResponse.conversations.find(
  conv => conv.sessionId === sessionId
);

if (currentConversation?.status === 'ongoing' && currentConversation.streamingId) {
  // Automatically connect to the existing stream
  console.log(`[ConversationView] Auto-connecting to ongoing stream: ${currentConversation.streamingId}`);
  setStreamingId(currentConversation.streamingId);
}
```

### Backend Support

The backend already provides the necessary information:
- Conversations with active streams have `status: 'ongoing'`
- The `streamingId` field is included for ongoing conversations
- This is managed by the `ConversationStatusTracker` service

### Data Flow

1. **Backend tracks active streams** via `ConversationStatusTracker`
2. **GET /api/conversations** returns status and streamingId for each conversation
3. **ConversationView** checks if opened conversation is ongoing
4. **useStreaming hook** automatically connects when streamingId is set
5. **Real-time updates** flow to all connected clients

## Benefits

- **Seamless multi-device experience** - Open conversation on any device and see live updates
- **No manual reconnection needed** - Automatic stream detection and connection
- **Consistent state** - All clients see the same conversation progress
- **Resource efficient** - Reuses existing stream connections

## Testing

To test the feature:

1. Start a conversation that takes time to process (e.g., complex code generation)
2. While Claude is still responding, open the same conversation in another tab
3. The new tab should automatically show the streaming updates

## Technical Notes

- The feature uses a simple polling approach (fetching conversation list)
- Future enhancement could use WebSockets for instant notification
- The 100-conversation limit in the API call is sufficient for most use cases
- No changes needed to the streaming infrastructure or backend APIs