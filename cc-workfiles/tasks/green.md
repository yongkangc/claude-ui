You are tasked to create a webui for the claude code (cc for short) cli (CCUI). CC is a code agent tool live in command line that brings up an interactive chat conversation flow with the user. CC has provided streaming jsonl responses and programmatic invoking, so that a webui binding for managing cc and interact with cc will be welcome by some user who prefer more portable and refined experience.

You are instructed to implement the major features of CCUI. The tests are already written, you MUST keep the tests untouched, make minimal update in the codebase to pass all tests. Report to me if you believe the tests are not correct.

Before you start, please read the plan carefully at @cc-workfiles/plans/implementation-plan-v1.md and resources file at @cc-workfiles/knowledge/claude-code-sdk.md, @cc-workfiles/knowledge/example-cc-config-folder.md and @cc-workfiles/knowledge/example-cc-stream-json.md. You explore the codebase in @backend and understand the architecture to know what to do for a plan.

Then, please go ahead and implement the features, and iterate the code until all tests pass nicely.