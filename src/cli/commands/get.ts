import { ClaudeHistoryReader } from '../../services/claude-history-reader';

interface GetOptions {
  json?: boolean;
}

export async function getCommand(sessionId: string, options: GetOptions): Promise<void> {
  try {
    const reader = new ClaudeHistoryReader();
    
    // Get conversation metadata
    const metadata = await reader.getConversationMetadata(sessionId);
    if (!metadata) {
      console.error(`Conversation ${sessionId} not found`);
      process.exit(1);
    }

    // Get conversation messages
    const messages = await reader.fetchConversation(sessionId);

    const result = {
      sessionId,
      metadata,
      messages: messages.length,
      conversation: messages
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // Display in human-readable format
    console.log(`\nConversation: ${sessionId}`);
    console.log('='.repeat(50));
    console.log(`Summary: ${metadata.summary}`);
    console.log(`Project Path: ${metadata.projectPath}`);
    console.log(`Model: ${metadata.model || 'Unknown'}`);
    console.log(`Messages: ${messages.length}`);
    console.log(`Total Cost: $${metadata.totalCost.toFixed(4)}`);
    console.log(`Total Duration: ${(metadata.totalDuration / 1000).toFixed(2)}s`);
    console.log('\nMessages:');
    console.log('-'.repeat(50));

    // Display messages
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      console.log(`\n[${i + 1}] ${msg.type.toUpperCase()} (${new Date(msg.timestamp).toLocaleString()})`);
      
      if (msg.message?.content) {
        // Handle different message content formats
        if (Array.isArray(msg.message.content)) {
          for (const content of msg.message.content) {
            if (content.type === 'text' && 'text' in content) {
              console.log(content.text.slice(0, 200) + (content.text.length > 200 ? '...' : ''));
            } else if (content.type === 'tool_use' && 'name' in content) {
              console.log(`[Tool: ${content.name}]`);
            } else if (content.type === 'tool_result' && 'content' in content) {
              console.log(`[Tool Result: ${content.tool_use_id}]`);
              if (typeof content.content === 'string') {
                console.log(content.content.slice(0, 500) + (content.content.length > 500 ? '...' : ''));
              } else {
                console.log('[Complex tool result]');
              }
            } else {
              // Fallback for unrecognized content types
              console.log(`[${content.type || 'Unknown'} content]`);
              try {
                const fallbackContent = JSON.stringify(content, null, 2);
                console.log(fallbackContent.slice(0, 300) + (fallbackContent.length > 300 ? '...' : ''));
              } catch {
                console.log('[Content could not be displayed]');
              }
            }
          }
        } else if (typeof msg.message.content === 'string') {
          console.log(msg.message.content.slice(0, 200) + (msg.message.content.length > 200 ? '...' : ''));
        } else {
          // Fallback for non-string, non-array content
          try {
            const fallbackContent = JSON.stringify(msg.message.content, null, 2);
            console.log(fallbackContent.slice(0, 300) + (fallbackContent.length > 300 ? '...' : ''));
          } catch {
            console.log('[Content could not be displayed]');
          }
        }
      }

      if (msg.costUSD) {
        console.log(`Cost: $${msg.costUSD.toFixed(4)}`);
      }
    }
  } catch (error) {
    console.error('Error getting conversation:', error);
    process.exit(1);
  }
}