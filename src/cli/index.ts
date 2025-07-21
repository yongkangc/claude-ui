#!/usr/bin/env node

import { Command } from 'commander';
import { serveCommand } from './commands/serve';
import { mcpCommand } from './commands/mcp';
import { listCommand } from './commands/list';
import { getCommand } from './commands/get';
import { statusCommand } from './commands/status';
import { resumeCommand } from './commands/resume';

const program = new Command();

program
  .name('ccui')
  .description('Claude Code Web UI CLI')
  .version('0.1.0');

// Server management commands
program
  .command('serve')
  .description('Start the CCUI backend server')
  .option('-p, --port <port>', 'Override configured port')
  .option('--log-level <level>', 'Override log level (debug, info, warn, error, silent)')
  .action(serveCommand);

program
  .command('mcp')
  .description('Start the MCP permission server')
  .option('--config <path>', 'Path to MCP configuration file', './config/mcp-config.json')
  .action(mcpCommand);

// Direct service commands
program
  .command('list')
  .description('List all conversations')
  .option('--project <path>', 'Filter by working directory')
  .option('--limit <number>', 'Maximum number of results', '20')
  .option('--offset <number>', 'Number of results to skip', '0')
  .option('--json', 'Output as JSON')
  .option('--format <type>', 'Display format: compact, table, detailed', 'compact')
  .option('--show-model', 'Show model information')
  .option('--no-summary', 'Hide conversation summaries')
  .action(listCommand);

program
  .command('get')
  .description('Get conversation details')
  .argument('<sessionId>', 'Session ID of the conversation')
  .option('--json', 'Output as JSON')
  .action(getCommand);

program
  .command('status')
  .description('Get system status')
  .option('--json', 'Output as JSON')
  .action(statusCommand);

program
  .command('resume')
  .description('Resume an existing conversation with a new message')
  .argument('<sessionId>', 'Session ID of the conversation to resume')
  .argument('<message>', 'Message to send to continue the conversation')
  .option('--server-port <port>', 'Port of the CCUI server', '3001')
  .option('--json', 'Output as JSON')
  .option('--debug', 'Enable debug logging')
  .action(resumeCommand);

program.parse();