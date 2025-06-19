By using node dist/cli/index.js get cd7f44a7-b3c2-4b30-b20b-8cd0062e67c0, we see the conversation are missing content for many turns. like from user or tool_use

By using node dist/cli/index.js get cd7f44a7-b3c2-4b30-b20b-8cd0062e67c0 --json | jq ".conversation[3]" we can see the json output is complete.

Please investigate why the conversation is missing content for many turns, you can update related code to add format print for more structure in messages and defaults to raw json if the content is not recognizable.

First research and think hard for a plan.