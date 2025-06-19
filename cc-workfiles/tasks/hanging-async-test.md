In current test pipeline, we have force exit of jest:

Ran all test suites.
Force exiting Jest: Have you considered using `--detectOpenHandles` to detect async operations that kept running after all tests finished?

Remove that will cause some tests to hang. Please investigate and fix. First research and think hard for a solution.