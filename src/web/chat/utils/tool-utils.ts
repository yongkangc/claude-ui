/**
 * Utility functions for tool message rendering
 */

/**
 * Convert absolute path to relative path if it's a subpath of working directory
 */
export function formatFilePath(path: string, workingDirectory?: string): string {
  console.debug('formatFilePath called with:', { path, workingDirectory });
  
  if (!path) {
    console.debug('formatFilePath: empty path, returning as-is');
    return path;
  }
  
  // If we have a working directory and the path starts with it, make it relative
  if (workingDirectory && path.startsWith(workingDirectory)) {
    const relativePath = path.slice(workingDirectory.length);
    // Remove leading slash if present
    const cleaned = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
    const result = cleaned ? `./${cleaned}` : './';
    console.debug('formatFilePath: converted to relative:', result);
    return result;
  }
  
  // If it starts with user home directory, show as ~
  // Note: In browser environment, we can't access process.env, so we'll use common paths
  const commonHomePaths = ['/home/', '/Users/'];
  for (const homePattern of commonHomePaths) {
    if (path.startsWith(homePattern)) {
      const result = `~${path.slice(homePattern.length - 1)}`;
      console.debug('formatFilePath: converted to home path:', result);
      return result;
    }
  }
  
  console.debug('formatFilePath: no conversion applied, returning original path');
  return path;
}

/**
 * Count number of lines in content (based on newlines)
 */
export function countLines(content: string): number {
  if (!content) return 0;
  // Count newlines + 1 for the content itself
  const newlineCount = (content.match(/\n/g) || []).length;
  return content.length > 0 ? newlineCount + 1 : 0;
}

/**
 * Format tool input parameters for display in labels
 */
export function formatToolInput(input: any, maxLength: number = 50): string {
  if (!input || typeof input !== 'object') {
    return String(input || '');
  }
  
  const entries = Object.entries(input);
  if (entries.length === 0) return '';
  
  if (entries.length === 1) {
    const [key, value] = entries[0];
    const formattedValue = typeof value === 'string' && value.length > maxLength 
      ? `"${value.slice(0, maxLength)}..."` 
      : typeof value === 'string' 
        ? `"${value}"` 
        : String(value);
    return `${key}: ${formattedValue}`;
  }
  
  // Multiple parameters - show key value pairs separated by commas
  const formatted = entries
    .map(([key, value]) => {
      const formattedValue = typeof value === 'string' && value.length > maxLength 
        ? `"${value.slice(0, maxLength)}..."` 
        : typeof value === 'string' 
          ? `"${value}"` 
          : String(value);
      return `${key}: ${formattedValue}`;
    })
    .join(', ');
    
  return formatted.length > maxLength ? `${formatted.slice(0, maxLength)}...` : formatted;
}

/**
 * Extract file count from LS tool result content
 */
export function extractFileCount(content: string): number {
  if (!content) return 0;
  
  // Count lines that represent file/directory entries
  // LS output typically has indented structure
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  
  // Count lines that look like file entries (have proper indentation)
  const fileLines = lines.filter(line => line.match(/^\s*-\s+/));
  
  return fileLines.length || lines.length;
}

/**
 * Parse todo items from JSON string content
 */
export function parseTodos(content: string): Array<{id: string; content: string; status: string}> {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.filter(item => 
        item && 
        typeof item === 'object' && 
        typeof item.content === 'string' &&
        typeof item.status === 'string'
      );
    }
  } catch (e) {
    console.warn('Failed to parse todos:', e);
  }
  return [];
}

/**
 * Format diff lines for Edit/MultiEdit tools
 */
export function formatDiffLines(oldString: string, newString: string): Array<{type: 'remove' | 'add'; content: string}> {
  const lines = [];
  
  // Split into lines and add removal lines
  const oldLines = oldString.split('\n');
  const newLines = newString.split('\n');
  
  oldLines.forEach(line => {
    lines.push({ type: 'remove' as const, content: line });
  });
  
  newLines.forEach(line => {
    lines.push({ type: 'add' as const, content: line });
  });
  
  return lines;
}

/**
 * Check if tool result has error status
 */
export function isToolError(toolResult?: { is_error?: boolean }): boolean {
  return toolResult?.is_error === true;
}

/**
 * Extract domain from URL for WebFetch
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return url;
  }
}