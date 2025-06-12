import { ClaudeHistoryReader } from '../../services/claude-history-reader';

interface ListOptions {
  project?: string;
  limit: string;
  offset: string;
  json?: boolean;
}

export async function listCommand(options: ListOptions): Promise<void> {
  try {
    const reader = new ClaudeHistoryReader();
    
    const filter = {
      projectPath: options.project,
      limit: parseInt(options.limit),
      offset: parseInt(options.offset),
      sortBy: 'updated' as const,
      order: 'desc' as const
    };

    const result = await reader.listConversations(filter);

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // Display in table format
    console.log(`Found ${result.total} conversations (showing ${result.conversations.length}):\n`);
    
    if (result.conversations.length === 0) {
      console.log('No conversations found.');
      return;
    }

    // Print table header
    console.log('Session ID'.padEnd(36) + ' | ' + 'Project Path'.padEnd(40) + ' | ' + 'Messages'.padEnd(8) + ' | ' + 'Updated');
    console.log('-'.repeat(36) + '-+-' + '-'.repeat(40) + '-+-' + '-'.repeat(8) + '-+-' + '-'.repeat(20));

    // Print each conversation
    for (const conv of result.conversations) {
      const sessionId = conv.sessionId.padEnd(36);
      const projectPath = (conv.projectPath || '').slice(0, 40).padEnd(40);
      const messageCount = conv.messageCount.toString().padEnd(8);
      const updated = new Date(conv.updatedAt).toLocaleDateString();
      
      console.log(`${sessionId} | ${projectPath} | ${messageCount} | ${updated}`);
    }

    // Show pagination info
    if (result.total > result.conversations.length) {
      const showing = Math.min(parseInt(options.offset) + parseInt(options.limit), result.total);
      console.log(`\nShowing ${parseInt(options.offset) + 1}-${showing} of ${result.total} conversations`);
    }
  } catch (error) {
    console.error('Error listing conversations:', error);
    process.exit(1);
  }
}