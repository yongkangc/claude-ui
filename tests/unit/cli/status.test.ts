// Create mock promisify function before imports
const mockPromisify = jest.fn();

// Mock the entire util module
jest.mock('util', () => {
  const actualUtil = jest.requireActual('util');
  return {
    ...actualUtil,
    promisify: mockPromisify
  };
});

import { statusCommand } from '@/cli/commands/status';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock other dependencies
jest.mock('child_process');
jest.mock('fs/promises');
jest.mock('os');
jest.mock('path');

const mockExec = exec as jest.MockedFunction<typeof exec>;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;
const mockPath = path as jest.Mocked<typeof path>;

// Mock console methods
const consoleSpy = {
  log: jest.spyOn(console, 'log').mockImplementation(),
  error: jest.spyOn(console, 'error').mockImplementation()
};

// Mock process.exit
const mockExit = jest.spyOn(process, 'exit').mockImplementation();

describe('CLI Status Command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockOs.homedir.mockReturnValue('/home/user');
    mockPath.join.mockImplementation((...args) => args.join('/'));
    
    // Mock process properties
    Object.defineProperty(process, 'version', { value: 'v18.17.0', configurable: true });
    mockOs.platform.mockReturnValue('darwin');
    mockOs.arch.mockReturnValue('x64');
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

  describe('statusCommand with successful Claude CLI detection', () => {
    beforeEach(() => {
      // Mock successful Claude CLI detection
      mockPromisify.mockImplementation((fn: any) => {
        return jest.fn().mockImplementation(async (cmd: string) => {
          if (cmd === 'claude --version') {
            return { stdout: 'claude version 1.0.19\n', stderr: '' };
          }
          if (cmd === 'which claude') {
            return { stdout: '/usr/local/bin/claude\n', stderr: '' };
          }
          throw new Error('Command not found');
        });
      });

      // Mock file system checks
      mockFs.access.mockImplementation(async (path: any) => {
        if (path.includes('.claude') || path.includes('config') || path.includes('mcp-config.json')) {
          return; // Files exist
        }
        throw new Error('Not found');
      });
    });

    it('should display status in human-readable format by default', async () => {
      await statusCommand({});

      expect(consoleSpy.log).toHaveBeenCalledWith('\nCCUI System Status');
      expect(consoleSpy.log).toHaveBeenCalledWith('='.repeat(30));
      expect(consoleSpy.log).toHaveBeenCalledWith('Claude CLI Version: claude version 1.0.19');
      expect(consoleSpy.log).toHaveBeenCalledWith('Claude CLI Path: Not found');
      expect(consoleSpy.log).toHaveBeenCalledWith('Claude Home Directory: ✓ Found (/home/user/.claude)');
      expect(consoleSpy.log).toHaveBeenCalledWith('Config Directory: ✓ Found (./config)');
      expect(consoleSpy.log).toHaveBeenCalledWith('MCP Config: ✓ Found (./config/mcp-config.json)');
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
        mcpConfigPath: './config/mcp-config.json',
        mcpConfigExists: true,
        nodeVersion: 'v18.17.0',
        platform: 'darwin',
        architecture: 'x64'
      };

      expect(consoleSpy.log).toHaveBeenCalledWith(JSON.stringify(expectedStatus, null, 2));
      expect(consoleSpy.log).not.toHaveBeenCalledWith('\nCCUI System Status');
    });
  });

  describe('statusCommand with Claude CLI not found', () => {
    beforeEach(() => {
      // Mock failed Claude CLI detection
      mockPromisify.mockImplementation((fn: any) => {
        return jest.fn().mockImplementation(async (cmd: string) => {
          throw new Error('Command not found');
        });
      });

      // Mock file system checks - no files exist
      mockFs.access.mockImplementation(async () => {
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

    it('should return correct JSON status when Claude CLI is not found', async () => {
      await statusCommand({ json: true });

      const expectedStatus = {
        claudeVersion: null,
        claudePath: null,
        claudeHomePath: '/home/user/.claude',
        claudeHomeExists: false,
        configPath: './config',
        configExists: false,
        mcpConfigPath: './config/mcp-config.json',
        mcpConfigExists: false,
        nodeVersion: 'v18.17.0',
        platform: 'darwin',
        architecture: 'x64'
      };

      expect(consoleSpy.log).toHaveBeenCalledWith(JSON.stringify(expectedStatus, null, 2));
    });
  });

  describe('statusCommand with partial file system access', () => {
    beforeEach(() => {
      // Mock successful Claude CLI detection
      mockPromisify.mockImplementation((fn: any) => {
        return jest.fn().mockImplementation(async (cmd: string) => {
          if (cmd === 'claude --version') {
            return { stdout: 'claude version 1.0.20\n', stderr: '' };
          }
          if (cmd === 'which claude') {
            return { stdout: '/opt/homebrew/bin/claude\n', stderr: '' };
          }
          throw new Error('Command not found');
        });
      });

      // Mock partial file system access
      mockFs.access.mockImplementation(async (path: any) => {
        if (path.includes('.claude')) {
          return; // Claude home exists
        }
        if (path.includes('config') && !path.includes('mcp-config.json')) {
          return; // Config dir exists
        }
        throw new Error('Not found');
      });
    });

    it('should handle mixed file system access correctly', async () => {
      await statusCommand({});

      expect(consoleSpy.log).toHaveBeenCalledWith('Claude Home Directory: ✓ Found (/home/user/.claude)');
      expect(consoleSpy.log).toHaveBeenCalledWith('Config Directory: ✓ Found (./config)');
      expect(consoleSpy.log).toHaveBeenCalledWith('MCP Config: ✗ Not found (./config/mcp-config.json)');
    });
  });

  describe('statusCommand error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Mock an error in the status collection process
      mockOs.homedir.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await statusCommand({});

      expect(consoleSpy.error).toHaveBeenCalledWith('Error checking system status:', expect.any(Error));
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle file system errors during checks', async () => {
      // Mock successful Claude CLI detection
      mockPromisify.mockImplementation((fn: any) => {
        return jest.fn().mockImplementation(async (cmd: string) => {
          if (cmd === 'claude --version') {
            return { stdout: 'claude version 1.0.19\n', stderr: '' };
          }
          throw new Error('Command not found');
        });
      });

      // Mock file system access throwing unexpected errors
      mockFs.access.mockImplementation(async () => {
        throw new Error('Permission denied');
      });

      await statusCommand({});

      // Should still complete successfully, just showing files as not found
      expect(consoleSpy.log).toHaveBeenCalledWith('Claude Home Directory: ✗ Not found (/home/user/.claude)');
      expect(consoleSpy.log).toHaveBeenCalledWith('Config Directory: ✗ Not found (./config)');
      expect(consoleSpy.error).not.toHaveBeenCalled();
      expect(mockExit).not.toHaveBeenCalled();
    });
  });

  describe('statusCommand with Claude path detection', () => {
    beforeEach(() => {
      // Mock Claude version failing but which succeeding
      mockPromisify.mockImplementation((fn: any) => {
        return jest.fn().mockImplementation(async (cmd: string) => {
          if (cmd === 'claude --version') {
            throw new Error('Version command failed');
          }
          if (cmd === 'which claude') {
            return { stdout: '/usr/local/bin/claude\n', stderr: '' };
          }
          throw new Error('Command not found');
        });
      });

      mockFs.access.mockImplementation(async () => {
        return; // All files exist
      });
    });

    it('should detect Claude path even when version command fails', async () => {
      await statusCommand({});

      expect(consoleSpy.log).toHaveBeenCalledWith('Claude CLI Version: Not found');
      expect(consoleSpy.log).toHaveBeenCalledWith('Claude CLI Path: Not found');
      expect(consoleSpy.log).toHaveBeenCalledWith('\n✗ Claude CLI not found. Please ensure it is installed and in your PATH.');
    });
  });

  describe('edge cases', () => {
    it('should handle different operating systems', async () => {
      mockOs.platform.mockReturnValue('win32');
      mockOs.arch.mockReturnValue('x64');

      mockPromisify.mockImplementation((fn: any) => {
        return jest.fn().mockImplementation(async () => {
          throw new Error('Command not found');
        });
      });

      mockFs.access.mockImplementation(async () => {
        throw new Error('Not found');
      });

      await statusCommand({});

      expect(consoleSpy.log).toHaveBeenCalledWith('Platform: win32');
      expect(consoleSpy.log).toHaveBeenCalledWith('Architecture: x64');
    });

    it('should handle empty stdout from commands', async () => {
      mockPromisify.mockImplementation((fn: any) => {
        return jest.fn().mockImplementation(async (cmd: string) => {
          if (cmd === 'claude --version') {
            return { stdout: '', stderr: '' };
          }
          throw new Error('Command not found');
        });
      });

      mockFs.access.mockImplementation(async () => {
        return;
      });

      await statusCommand({});

      expect(consoleSpy.log).toHaveBeenCalledWith('Claude CLI Version: '); // Empty version
    });
  });
});