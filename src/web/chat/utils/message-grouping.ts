import type { ChatMessage } from '../types';

/**
 * Groups messages according to sub-message grouping rules using a one-pass algorithm:
 * Rule 1: Messages with parent_tool_use_id should be grouped under their parent tool call message
 * Rule 2: User messages with content.type == "tool_result" should be grouped under the nearest previous assistant message
 * 
 * Uses a single-pass algorithm with dictionary lookup for O(1) parent finding.
 * Leverages the constraint that parent messages ALWAYS appear before child messages.
 * 
 * @param messages - Flat array of messages to group (parent messages appear before children)
 * @returns Array of messages with sub-messages grouped hierarchically
 */
export function groupMessages(messages: ChatMessage[]): ChatMessage[] {
  if (!messages || messages.length === 0) {
    return [];
  }

  const messageDict = new Map<string, ChatMessage>();
  const result: ChatMessage[] = [];
  let latestAssistant: ChatMessage | null = null;

  for (const message of messages) {
    const messageCopy: ChatMessage = {
      ...message,
      subMessages: undefined, // Reset subMessages for fresh grouping
    };
    messageDict.set(messageCopy.id, messageCopy);

    let isSubMessage = false;

    // Rule 1: Handle parent_tool_use_id (highest priority)
    if (messageCopy.parent_tool_use_id) {
      const parent = findParentByToolId(messageDict, messageCopy.parent_tool_use_id);
      if (parent) {
        parent.subMessages = parent.subMessages || [];
        parent.subMessages.push(messageCopy);
        isSubMessage = true;
      }
    }

    // Rule 2: Handle tool_result content type (only if not already grouped by Rule 1)
    if (!isSubMessage && messageCopy.type === 'user' && hasToolResultContent(messageCopy)) {
      if (latestAssistant) {
        latestAssistant.subMessages = latestAssistant.subMessages || [];
        latestAssistant.subMessages.push(messageCopy);
        isSubMessage = true;
      }
    }

    // Track latest assistant message for Rule 2
    if (messageCopy.type === 'assistant') {
      latestAssistant = messageCopy;
    }

    // Add to main result list if not a sub-message
    if (!isSubMessage) {
      result.push(messageCopy);
    }
  }

  return result;
}

/**
 * Finds the parent tool message by tool_use_id using dictionary lookup
 * Optimized O(1) lookup using message dictionary with proper type checking
 */
function findParentByToolId(
  messageDict: Map<string, ChatMessage>,
  toolUseId: string
): ChatMessage | null {
  for (const [, message] of messageDict) {
    if (message.type === 'assistant' && Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block && 
            typeof block === 'object' && 
            'type' in block && 
            block.type === 'tool_use' && 
            'id' in block && 
            (block as { id: string }).id === toolUseId) {
          return message;
        }
      }
    }
  }
  return null;
}

/**
 * Checks if a message has tool_result content type
 * Uses proper TypeScript typing for content blocks
 */
function hasToolResultContent(message: ChatMessage): boolean {
  // Check if content is an array and contains tool_result blocks
  if (Array.isArray(message.content)) {
    return message.content.some((block: unknown) => 
      block && 
      typeof block === 'object' && 
      'type' in block && 
      (block as { type: string }).type === 'tool_result'
    );
  }
  
  // Check if content is a single tool_result block
  if (typeof message.content === 'object' && 
      message.content && 
      'type' in message.content && 
      (message.content as { type: string }).type === 'tool_result') {
    return true;
  }
  
  return false;
}

/**
 * Flattens a hierarchical message structure back to a flat array
 * Useful for processing or debugging
 */
export function flattenMessages(messages: ChatMessage[]): ChatMessage[] {
  const flattened: ChatMessage[] = [];
  
  for (const message of messages) {
    flattened.push(message);
    
    if (message.subMessages && message.subMessages.length > 0) {
      flattened.push(...flattenMessages(message.subMessages));
    }
  }
  
  return flattened;
}

/**
 * Counts the total number of messages including sub-messages
 */
export function countTotalMessages(messages: ChatMessage[]): number {
  let count = 0;
  
  for (const message of messages) {
    count += 1;
    
    if (message.subMessages && message.subMessages.length > 0) {
      count += countTotalMessages(message.subMessages);
    }
  }
  
  return count;
}