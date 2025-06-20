import { ClaudeHistoryReader } from '../../services/claude-history-reader';
import { ConversationSummary } from '../../types';

interface ListOptions {
  project?: string;
  limit: string;
  offset: string;
  json?: boolean;
  format?: 'compact' | 'detailed' | 'table';
  showCost?: boolean;
  showModel?: boolean;
  noSummary?: boolean;
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

    if (result.conversations.length === 0) {
      console.log('No conversations found.');
      return;
    }

    const format = options.format || 'compact';
    
    if (format === 'detailed') {
      displayDetailed(result.conversations, options);
    } else if (format === 'table') {
      displayTable(result.conversations, options);
    } else {
      displayCompact(result.conversations, options);
    }

    // Show pagination info
    if (result.total > result.conversations.length) {
      const showing = Math.min(parseInt(options.offset) + parseInt(options.limit), result.total);
      console.log(`\n${parseInt(options.offset) + 1}-${showing} of ${result.total} total`);
    }
  } catch (error) {
    console.error('Error listing conversations:', error);
    process.exit(1);
  }
}

// Helper functions for formatting
function formatCost(cost: number): string {
  if (cost === 0) return '$0';
  if (cost < 0.001) return '<$0.001';
  return `$${cost.toFixed(3)}`;
}

function formatDuration(durationMs: number): string {
  if (durationMs === 0) return '0s';
  if (durationMs < 1000) return `${durationMs}ms`;
  const seconds = Math.round(durationMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function displayCompact(conversations: ConversationSummary[], options: ListOptions): void {
  for (const conv of conversations) {
    const sessionShort = conv.sessionId.substring(0, 8);
    const projectName = conv.projectPath.split('/').pop() || conv.projectPath;
    const summary = options.noSummary ? '' : truncateText(conv.summary, 60);
    const timeAgo = formatRelativeTime(conv.updatedAt);
    const msgs = `${conv.messageCount}msg`;
    
    let line = `${sessionShort} ${projectName.padEnd(20)} ${msgs.padStart(5)} ${timeAgo.padStart(8)}`;
    
    if (options.showCost && conv.totalCost > 0) {
      line += ` ${formatCost(conv.totalCost).padStart(8)}`;
    }
    
    if (options.showModel) {
      const modelShort = conv.model.replace('claude-', '').replace('-20250514', '');
      line += ` ${modelShort.padStart(12)}`;
    }
    
    console.log(line);
    
    if (!options.noSummary && summary) {
      console.log(`  ${summary}`);
    }
  }
}

function displayTable(conversations: ConversationSummary[], options: ListOptions): void {
  // Build headers and calculate column widths
  const headers = ['Session', 'Project', 'Msgs', 'Updated'];
  const widths = [8, 25, 5, 8];
  
  if (options.showCost) {
    headers.push('Cost');
    widths.push(8);
  }
  
  if (options.showModel) {
    headers.push('Model');
    widths.push(12);
  }
  
  if (!options.noSummary) {
    headers.push('Summary');
    widths.push(40);
  }
  
  // Print header
  console.log(headers.map((h, i) => h.padEnd(widths[i])).join(' | '));
  console.log(widths.map(w => '-'.repeat(w)).join('-+-'));
  
  // Print rows
  for (const conv of conversations) {
    const row = [
      conv.sessionId.substring(0, 8),
      truncateText(conv.projectPath.split('/').pop() || conv.projectPath, 25),
      conv.messageCount.toString(),
      formatRelativeTime(conv.updatedAt)
    ];
    
    if (options.showCost) {
      row.push(formatCost(conv.totalCost));
    }
    
    if (options.showModel) {
      const modelShort = conv.model.replace('claude-', '').replace('-20250514', '');
      row.push(modelShort);
    }
    
    if (!options.noSummary) {
      row.push(truncateText(conv.summary, 40));
    }
    
    console.log(row.map((cell, i) => cell.padEnd(widths[i])).join(' | '));
  }
}

function displayDetailed(conversations: ConversationSummary[], options: ListOptions): void {
  for (let i = 0; i < conversations.length; i++) {
    const conv = conversations[i];
    console.log(`${conv.sessionId}`);
    console.log(`  Project: ${conv.projectPath}`);
    if (!options.noSummary) {
      console.log(`  Summary: ${conv.summary}`);
    }
    console.log(`  Messages: ${conv.messageCount}, Updated: ${formatRelativeTime(conv.updatedAt)}`);
    
    if (options.showCost || options.showModel || conv.totalCost > 0) {
      const details = [];
      if (conv.totalCost > 0) details.push(`Cost: ${formatCost(conv.totalCost)}`);
      if (conv.totalDuration > 0) details.push(`Duration: ${formatDuration(conv.totalDuration)}`);
      if (options.showModel) details.push(`Model: ${conv.model}`);
      if (details.length > 0) {
        console.log(`  ${details.join(', ')}`);
      }
    }
    
    if (i < conversations.length - 1) console.log('');
  }
}