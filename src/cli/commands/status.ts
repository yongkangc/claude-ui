import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

interface StatusOptions {
  json?: boolean;
}

export async function statusCommand(options: StatusOptions): Promise<void> {
  try {
    const status = await getSystemStatus();

    if (options.json) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    // Display in human-readable format
    console.log('\nCCUI System Status');
    console.log('='.repeat(30));
    console.log(`Claude CLI Version: ${status.claudeVersion || 'Not found'}`);
    console.log(`Claude CLI Path: ${status.claudePath || 'Not found'}`);
    console.log(`Claude Home Directory: ${status.claudeHomeExists ? '✓ Found' : '✗ Not found'} (${status.claudeHomePath})`);
    console.log(`Config Directory: ${status.configExists ? '✓ Found' : '✗ Not found'} (${status.configPath})`);
    console.log(`MCP Config: ${status.mcpConfigExists ? '✓ Found' : '✗ Not found'} (${status.mcpConfigPath})`);
    console.log(`Node.js Version: ${status.nodeVersion}`);
    console.log(`Platform: ${status.platform}`);
    console.log(`Architecture: ${status.architecture}`);

    if (status.claudeVersion) {
      console.log('\n✓ Claude CLI is properly installed and accessible');
    } else {
      console.log('\n✗ Claude CLI not found. Please ensure it is installed and in your PATH.');
      console.log('  Visit https://claude.ai/code for installation instructions.');
    }

    if (!status.claudeHomeExists) {
      console.log('✗ Claude home directory not found. Run Claude CLI at least once to initialize.');
    }
  } catch (error) {
    console.error('Error checking system status:', error);
    process.exit(1);
  }
}

async function getSystemStatus() {
  const claudeHomePath = path.join(os.homedir(), '.claude');
  const configPath = './config';
  const mcpConfigPath = './config/mcp-config.json';

  // Check Claude CLI installation
  let claudeVersion = null;
  let claudePath = null;
  try {
    const result = await execAsync('claude --version');
    claudeVersion = result.stdout.trim();
  } catch (error) {
    // Try to find claude in common locations
    try {
      const whichResult = await execAsync('which claude');
      claudePath = whichResult.stdout.trim();
    } catch {
      // Claude not found
    }
  }

  // Check if Claude home directory exists
  let claudeHomeExists = false;
  try {
    await fs.access(claudeHomePath);
    claudeHomeExists = true;
  } catch {
    // Directory doesn't exist
  }

  // Check if config directory exists
  let configExists = false;
  try {
    await fs.access(configPath);
    configExists = true;
  } catch {
    // Directory doesn't exist
  }

  // Check if MCP config exists
  let mcpConfigExists = false;
  try {
    await fs.access(mcpConfigPath);
    mcpConfigExists = true;
  } catch {
    // File doesn't exist
  }

  return {
    claudeVersion,
    claudePath,
    claudeHomePath,
    claudeHomeExists,
    configPath,
    configExists,
    mcpConfigPath,
    mcpConfigExists,
    nodeVersion: process.version,
    platform: os.platform(),
    architecture: os.arch()
  };
}