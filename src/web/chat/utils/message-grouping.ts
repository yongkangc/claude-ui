import type { ChatMessage } from '../types';

/**
 * Groups messages according to sub-message grouping rules:
 * Rule 1: Messages with parent_tool_use_id should be grouped under their parent tool call message
 * Rule 2: User messages with content.type == "tool_result" should be grouped under the nearest previous assistant message
 * 
 * Uses a two-pass algorithm to ensure parent messages are found even if they appear after child messages.
 * 
 * @param messages - Flat array of messages to group
 * @returns Array of messages with sub-messages grouped hierarchically
 */
export function groupMessages(messages: ChatMessage[]): ChatMessage[] {
  if (!messages || messages.length === 0) {
    return [];
  }

  const grouped: ChatMessage[] = [];
  const messageMap = new Map<string, ChatMessage>();
  
  // First pass: build complete message map with all messages
  for (const message of messages) {
    const messageCopy: ChatMessage = {
      ...message,
      subMessages: undefined, // Reset subMessages for fresh grouping
    };
    messageMap.set(messageCopy.id, messageCopy);
  }
  
  // Second pass: apply grouping rules with index tracking
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const messageCopy = messageMap.get(message.id)!;
    
    // Rule 1: Handle parent_tool_use_id
    if (message.parent_tool_use_id) {
      const parent = findParentToolMessage(messageMap, message.parent_tool_use_id);
      if (parent) {
        parent.subMessages = parent.subMessages || [];
        parent.subMessages.push(messageCopy);
        continue;
      }
    }
    
    // Rule 2: Handle tool_result content type
    if (message.type === 'user' && hasToolResultContent(message)) {
      const nearestAssistant = findNearestAssistantMessage(messages, i);
      if (nearestAssistant) {
        // Get the copy from messageMap to ensure we're updating the right instance
        const nearestAssistantCopy = messageMap.get(nearestAssistant.id)!;
        nearestAssistantCopy.subMessages = nearestAssistantCopy.subMessages || [];
        nearestAssistantCopy.subMessages.push(messageCopy);
        continue;
      }
    }
    
    // Regular message - add to main list
    grouped.push(messageCopy);
  }

  return grouped;
}

/**
 * Finds the parent tool message by tool_use_id
 * Optimized to use the messageMap efficiently with proper type checking
 */
function findParentToolMessage(
  messageMap: Map<string, ChatMessage>,
  toolUseId: string
): ChatMessage | null {
  for (const [, message] of messageMap) {
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
 * Finds the nearest previous assistant message in the original messages array
 * This ensures we find parent messages even if they haven't been added to grouped yet
 */
function findNearestAssistantMessage(messages: ChatMessage[], currentIndex: number): ChatMessage | null {
  // Search backwards from current position in the original messages array
  for (let i = currentIndex - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.type === 'assistant') {
      return message;
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