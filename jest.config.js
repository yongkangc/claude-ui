module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@modelcontextprotocol/sdk/server/index.js$': '<rootDir>/tests/__mocks__/mcp-server-mock.ts',
    '^@modelcontextprotocol/sdk/server/stdio.js$': '<rootDir>/tests/__mocks__/mcp-stdio-mock.ts'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000,
  // Run integration tests serially to avoid resource conflicts
  maxWorkers: 1
};