// Mock the child_process exec function
const mockExecAsync = jest.fn();

// Mock dependencies
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

jest.mock('util', () => ({
  promisify: jest.fn(() => mockExecAsync)
}));

import { statusCommand } from '@/cli/commands/status';

jest.mock('fs/promises', () => ({
  access: jest.fn()
}));

jest.mock('os', () => ({
  homedir: jest.fn(() => '/home/user'),
  platform: jest.fn(() => 'darwin'),
  arch: jest.fn(() => 'x64')
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/'))
}));

// Mock console and process
const consoleSpy = {
  log: jest.spyOn(console, 'log').mockImplementation(),
  error: jest.spyOn(console, 'error').mockImplementation()
};

const mockExit = jest.spyOn(process, 'exit').mockImplementation();

// Mock fs access function
const mockAccess = require('fs/promises').access;

describe('CLI Status Command (Working)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock process properties
    Object.defineProperty(process, 'version', { value: 'v18.17.0', configurable: true });
  });

  afterEach(() => {
    consoleSpy.log.mockClear();
    consoleSpy.error.mockClear();
    mockExit.mockClear();
  });

  afterAll(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.error.mockRestore();
    mockExit.mockRestore();
  });

  describe('successful status check', () => {
    beforeEach(() => {
      // Mock successful Claude CLI detection
      mockExecAsync.mockImplementation(async (cmd: string) => {
        if (cmd === 'claude --version') {
          return { stdout: 'claude version 1.0.19\n', stderr: '' };
        }
        if (cmd === 'which claude') {
          return { stdout: '/usr/local/bin/claude\n', stderr: '' };
        }
        throw new Error('Command not found');
      });

      // Mock file system checks - all files exist
      mockAccess.mockResolvedValue(undefined);
    });

    it('should display status in human-readable format', async () => {
      await statusCommand({});

      expect(consoleSpy.log).toHaveBeenCalledWith('\nCCUI System Status');
      expect(consoleSpy.log).toHaveBeenCalledWith('='.repeat(30));
      expect(consoleSpy.log).toHaveBeenCalledWith('Claude CLI Version: claude version 1.0.19');
      expect(consoleSpy.log).toHaveBeenCalledWith('Claude CLI Path: Not found');
      expect(consoleSpy.log).toHaveBeenCalledWith('Claude Home Directory: ✓ Found (/home/user/.claude)');
      expect(consoleSpy.log).toHaveBeenCalledWith('Config Directory: ✓ Found (./config)');
      expect(consoleSpy.log).toHaveBeenCalledWith('Node.js Version: v18.17.0');
      expect(consoleSpy.log).toHaveBeenCalledWith('Platform: darwin');
      expect(consoleSpy.log).toHaveBeenCalledWith('Architecture: x64');
      expect(consoleSpy.log).toHaveBeenCalledWith('\n✓ Claude CLI is properly installed and accessible');
    });

    it('should display status in JSON format when requested', async () => {
      await statusCommand({ json: true });

      const expectedStatus = {
        claudeVersion: 'claude version 1.0.19',
        claudePath: null,
        claudeHomePath: '/home/user/.claude',
        claudeHomeExists: true,
        configPath: './config',
        configExists: true,
        nodeVersion: 'v18.17.0',
        platform: 'darwin',
        architecture: 'x64'
      };

      expect(consoleSpy.log).toHaveBeenCalledWith(JSON.stringify(expectedStatus, null, 2));
      expect(consoleSpy.log).not.toHaveBeenCalledWith('\nCCUI System Status');
    });
  });

  describe('Claude CLI not found', () => {
    beforeEach(() => {
      // Mock failed Claude CLI detection
      mockExecAsync.mockImplementation(async (cmd: string) => {
        throw new Error('Command not found');
      });

      // Mock file system checks - no files exist
      mockAccess.mockImplementation(async () => {
        throw new Error('Not found');
      });
    });

    it('should display warning when Claude CLI is not found', async () => {
      await statusCommand({});

      expect(consoleSpy.log).toHaveBeenCalledWith('Claude CLI Version: Not found');
      expect(consoleSpy.log).toHaveBeenCalledWith('Claude CLI Path: Not found');
      expect(consoleSpy.log).toHaveBeenCalledWith('Claude Home Directory: ✗ Not found (/home/user/.claude)');
      expect(consoleSpy.log).toHaveBeenCalledWith('\n✗ Claude CLI not found. Please ensure it is installed and in your PATH.');
      expect(consoleSpy.log).toHaveBeenCalledWith('  Visit https://claude.ai/code for installation instructions.');
      expect(consoleSpy.log).toHaveBeenCalledWith('✗ Claude home directory not found. Run Claude CLI at least once to initialize.');
    });
  });

  describe('error handling', () => {
    it('should handle unexpected errors', async () => {
      // Mock os.homedir to throw an unexpected error
      const mockOs = require('os');
      mockOs.homedir.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await statusCommand({});

      expect(consoleSpy.error).toHaveBeenCalledWith('Error checking system status:', expect.any(Error));
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });
});