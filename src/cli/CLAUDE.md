# CLI Interface

This directory contains the command-line interface for CCUI backend, built with Commander.js.

## Available Commands

```bash
# Start the CCUI backend server
ccui serve --port 3001 --log-level info

# List all conversations
ccui list --project /path/to/project --limit 20 --json

# Get conversation details
ccui get <sessionId> --json

# Get system status
ccui status --json

# Resume an existing conversation
ccui resume <sessionId> <message> --json --debug
```


## Command Structure

Commands are organized in `/src/cli/commands/` with each command in its own file:

- `serve.ts` - Start the CCUI backend server
- `list.ts` - List conversation history
- `get.ts` - Get conversation details
- `status.ts` - System status information
- `resume.ts` - Resume existing conversations

## Server Command

The `serve` command starts the CCUI backend server with the following options:

- `--port <port>` - Override the configured port
- `--log-level <level>` - Set the logging level (silent, error, warn, info, debug)
  - Sets the LOG_LEVEL environment variable before server initialization
  - Affects both console output and log streaming
  - Default: "info" (or from LOG_LEVEL environment variable)

## Resume Conversation

Resume existing conversations using Claude CLI's `--resume` functionality:

**CLI Usage:**
```bash
ccui resume <sessionId> <message> [--json] [--debug] [--server-port <port>]
```

Returns new streaming ID for continued conversation. Session parameters (model, working directory, etc.) are inherited from original conversation. The CLI command provides real-time streaming output and supports both human-readable and JSON output formats.

## Claude CLI Command Construction

### Basic Patterns
```bash
# Basic patterns
claude -p "query" --output-format stream-json --verbose
claude -p "query" --model claude-opus-4-20250514 --max-turns 5
claude --resume <session-id> "continue message"
claude --continue  # Continue most recent conversation

# Tool control patterns
claude -p "query" --allowedTools "Bash,Read,Write,Edit"
claude -p "query" --disallowedTools "Bash(git:*),WebSearch"
claude -p "query" --allowedTools "mcp__filesystem__read_file"

# Directory and context
claude -p "query" --add-dir /additional/path --add-dir /another/path
```

## Conversation History Structure

The `~/.claude` directory follows this pattern:
```
~/.claude/
├── projects/
│   └── {encoded-working-directory}/
│       └── {session-id}.jsonl
├── settings.json
├── statsig/
└── todos/
```

## Development Practices

- **Commander.js** for command structure and argument parsing
- **Consistent JSON output** for programmatic use
- **Error handling** with proper exit codes
- **Debug mode** support for troubleshooting
- **Logging configuration** via `--log-level` flag (serve command only) with Pino multistream support
  - Log levels: silent, error, warn, info, debug
  - Properly filters both console and file stream outputs
  - Overrides config file settings when specified