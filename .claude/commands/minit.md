---
allowed-tools: Bash
description: Create or update CLAUDE.md file
---

!`ARG="$ARGUMENTS"; [ -z "$ARG" ] && ARG="."; [ ! -d "$ARG" ] && { echo "Error: '$ARG' is not a valid directory." >&2; exit 1; }; CLAUDE_PATH="${ARG%/}/CLAUDE.md"; echo -e "Please analyze the code under $ARG and create or update a CLAUDE.md file, which will be given to future instances of Claude Code to operate in this subdirectory/repository."; if [ -f "$CLAUDE_PATH" ]; then echo -e "There exists a $CLAUDE_PATH, please analyze it and suggest updates and improvements."; else echo "The $CLAUDE_PATH does not exist, You need to make the initial CLAUDE.md file."; fi; BASE_COMMIT=$(git log -1 --follow --format=%H -- "$CLAUDE_PATH" 2>/dev/null); if [ -z "$BASE_COMMIT" ]; then echo "There is no commit where $CLAUDE_PATH was last changed"; else echo "Following are the changed files under $ARG since the last commit where $CLAUDE_PATH was updated (#$BASE_COMMIT):"; git --no-pager diff --stat "$BASE_COMMIT"..HEAD -- "${ARG%/}/"; fi`

What to add:
1. Commands that will be commonly used, such as how to build, lint, and run tests. Include the necessary commands to develop in this codebase, such as how to run a single test.
2. High-level code architecture and structure so that future instances can be productive more quickly. Focus on the "big picture" architecture that requires reading multiple files to understand
3. If there have been significant changes to the codebase since the last update of CLAUDE.md that make the current file outdated, misleading, or missing important aspects of the overall architecture, update CLAUDE.md to accurately reflect the new architecture.

Usage notes:
- When you make the initial CLAUDE.md, do not repeat yourself and do not include obvious instructions like "Provide helpful error messages to users", "Write unit tests for all new utilities", "Never include sensitive information (API keys, tokens) in code or commits" 
- When you update an existing CLAUDE.md, make only essential and minimal changes needed to accurately reflect the current high-level architecture. Do not include changelogs or details like "Created new classes," "Removed legacy code," "Fixed bugs", "Data Pipeline (NEW)"
- When you create or update a CLAUDE.md in a subdirectory, include only the high-level architecture and structure relevant to that subdirectory. Do not provide instructions or describe implementation details from other directories or parent directories.
- Avoid listing every component or file structure that can be easily discovered
- Don't include generic development practices
- If there are Cursor rules (in .cursor/rules/ or .cursorrules) or Copilot rules (in .github/copilot-instructions.md), make sure to include the important parts.
- If there is a README.md, make sure to include the important parts. 
- Do not make up information such as "Common Development Tasks", "Tips for Development", "Support and Documentation" unless this is expressly included in other files that you read.
- Be sure to prefix the file with the following text:

```
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository/subdirectory.
```