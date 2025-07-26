Please create an integration test for the real cc integration. You research and think hard for an plan.

Resources:

- @tests/integration/streaming-integration.test.ts to understand how to setup integrated test with a real server.
- The mocked cc (@tests/__mocks__/claude) for the input/output format for a mock cc
- The real cc input/output sample at @cc-workfiles/knowledge/cc-with-fake-home-example.txt

Goal:

- Real cc invokes polluting the home directory and cause money. You need to set a random fake home directory for the test (see tests/utils/test-helpers.ts). Please first investigate how to setup custom env var for node js spawned process.
- The fake home cc will always reply with api error message. You test this by first start a conversation, then read the streaming. Then you call list api to get that one conversation, read its content by api, check if it contains the error message. And that's it.

Implementation:

1. First you experiment with how to setup custom env var for node js spawned process.
2. TDD: you write the test first with expectations for correct code.
3. You adjust the test or (minimally) the code to pass the test.
4. When you are done, you make sure that precommit hook is happy.

Notes:
Final tweak: 1. No cc uses CLAUDE_HOME. 2. use relative path for executables 3.use test Override
Look for the claude code executable in the node modules as @package.json already has