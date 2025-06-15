import { MCPConfigValidator } from '@/utils/mcp-config-validator';
import { CCUIError } from '@/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('MCPConfigValidator', () => {
  let tempDir: string;
  let validConfigPath: string;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-config-test-'));

    // Create a valid MCP config file
    const validConfig = {
      mcpServers: {
        ccui: {
          command: 'node',
          args: ['./dist/mcp-server/index.js'],
          env: {
            CCUI_API_URL: 'http://localhost:3001'
          }
        },
        testServer: {
          command: 'python',
          args: ['-m', 'test_server'],
          cwd: '/tmp'
        }
      }
    };

    validConfigPath = path.join(tempDir, 'valid-config.json');
    await fs.writeFile(validConfigPath, JSON.stringify(validConfig, null, 2));
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('validateConfig', () => {
    it('should validate a correct configuration file', async () => {
      const config = await MCPConfigValidator.validateConfig(validConfigPath);

      expect(config).toHaveProperty('mcpServers');
      expect(config.mcpServers).toHaveProperty('ccui');
      expect(config.mcpServers.ccui.command).toBe('node');
      expect(config.mcpServers.ccui.args).toEqual(['./dist/mcp-server/index.js']);
    });

    it('should throw error for non-existent file', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent.json');

      await expect(MCPConfigValidator.validateConfig(nonExistentPath))
        .rejects.toThrow(CCUIError);
      
      await expect(MCPConfigValidator.validateConfig(nonExistentPath))
        .rejects.toThrow('MCP configuration file not found');
    });

    it('should throw error for invalid JSON', async () => {
      const invalidJsonPath = path.join(tempDir, 'invalid.json');
      await fs.writeFile(invalidJsonPath, '{ invalid json content');

      await expect(MCPConfigValidator.validateConfig(invalidJsonPath))
        .rejects.toThrow(CCUIError);
      
      await expect(MCPConfigValidator.validateConfig(invalidJsonPath))
        .rejects.toThrow('invalid JSON');
    });

    it('should throw error for missing mcpServers property', async () => {
      const invalidConfigPath = path.join(tempDir, 'invalid-schema.json');
      await fs.writeFile(invalidConfigPath, JSON.stringify({ wrongProperty: {} }));

      await expect(MCPConfigValidator.validateConfig(invalidConfigPath))
        .rejects.toThrow(CCUIError);
      
      await expect(MCPConfigValidator.validateConfig(invalidConfigPath))
        .rejects.toThrow('invalid structure');
    });

    it('should throw error for server without command', async () => {
      const invalidConfigPath = path.join(tempDir, 'no-command.json');
      const invalidConfig = {
        mcpServers: {
          badServer: {
            args: ['test']
            // missing command
          }
        }
      };
      await fs.writeFile(invalidConfigPath, JSON.stringify(invalidConfig));

      await expect(MCPConfigValidator.validateConfig(invalidConfigPath))
        .rejects.toThrow(CCUIError);
      
      await expect(MCPConfigValidator.validateConfig(invalidConfigPath))
        .rejects.toThrow('Required');
    });

    it('should accept server with minimal configuration', async () => {
      const minimalConfigPath = path.join(tempDir, 'minimal.json');
      const minimalConfig = {
        mcpServers: {
          minimal: {
            command: 'echo'
          }
        }
      };
      await fs.writeFile(minimalConfigPath, JSON.stringify(minimalConfig));

      const config = await MCPConfigValidator.validateConfig(minimalConfigPath);
      
      expect(config.mcpServers.minimal.command).toBe('echo');
      expect(config.mcpServers.minimal.args).toBeUndefined();
    });
  });

  describe('validateServerExecutable', () => {
    it('should validate Node.js server with existing script', async () => {
      // Create a test script file
      const scriptPath = path.join(tempDir, 'test-script.js');
      await fs.writeFile(scriptPath, 'console.log("test");');

      const serverConfig = {
        command: 'node',
        args: [scriptPath]
      };

      const isValid = await MCPConfigValidator.validateServerExecutable(serverConfig);
      expect(isValid).toBe(true);
    });

    it('should return false for Node.js server with non-existent script', async () => {
      const serverConfig = {
        command: 'node',
        args: ['/non/existent/script.js']
      };

      const isValid = await MCPConfigValidator.validateServerExecutable(serverConfig);
      expect(isValid).toBe(false);
    });

    it('should return true for non-Node.js commands', async () => {
      const serverConfig = {
        command: 'python',
        args: ['-m', 'some_module']
      };

      const isValid = await MCPConfigValidator.validateServerExecutable(serverConfig);
      expect(isValid).toBe(true);
    });

    it('should return true for command without args', async () => {
      const serverConfig = {
        command: 'echo'
      };

      const isValid = await MCPConfigValidator.validateServerExecutable(serverConfig);
      expect(isValid).toBe(true);
    });
  });

  describe('resolveMCPConfigPath', () => {
    it('should resolve relative paths', () => {
      const relativePath = './config/mcp-config.json';
      const resolved = MCPConfigValidator.resolveMCPConfigPath(relativePath);
      
      expect(path.isAbsolute(resolved)).toBe(true);
      expect(resolved).toContain('mcp-config.json');
    });

    it('should return absolute paths unchanged', () => {
      const absolutePath = '/absolute/path/to/config.json';
      const resolved = MCPConfigValidator.resolveMCPConfigPath(absolutePath);
      
      expect(resolved).toBe(absolutePath);
    });
  });

  describe('validateAllServers', () => {
    it('should validate all servers in configuration', async () => {
      // Create test scripts
      const script1Path = path.join(tempDir, 'script1.js');
      const script2Path = path.join(tempDir, 'script2.js');
      await fs.writeFile(script1Path, 'console.log("script1");');
      await fs.writeFile(script2Path, 'console.log("script2");');

      const config = {
        mcpServers: {
          server1: {
            command: 'node',
            args: [script1Path]
          },
          server2: {
            command: 'node',
            args: [script2Path]
          },
          server3: {
            command: 'node',
            args: ['/non/existent/script.js']
          }
        }
      };

      const result = await MCPConfigValidator.validateAllServers(config);

      expect(result.valid.server1).toBe(true);
      expect(result.valid.server2).toBe(true);
      expect(result.valid.server3).toBe(false);
      expect(result.errors.server3).toContain('not accessible');
    });

    it('should handle empty configuration', async () => {
      const config = { mcpServers: {} };
      
      const result = await MCPConfigValidator.validateAllServers(config);

      expect(Object.keys(result.valid)).toHaveLength(0);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });
  });
});