import { serveCommand } from '@/cli/commands/serve';
import { CCUIServer } from '@/ccui-server';

// Mock CCUIServer
jest.mock('@/ccui-server');

const MockedCCUIServer = CCUIServer as jest.MockedClass<typeof CCUIServer>;

// Mock console methods
const consoleSpy = {
  log: jest.spyOn(console, 'log').mockImplementation(),
  error: jest.spyOn(console, 'error').mockImplementation()
};

// Mock process methods
const mockExit = jest.spyOn(process, 'exit').mockImplementation();
const mockOn = jest.spyOn(process, 'on').mockImplementation();

describe('CLI Serve Command', () => {
  let mockServer: jest.Mocked<CCUIServer>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock server instance
    mockServer = {
      start: jest.fn(),
      stop: jest.fn()
    } as any;
    
    MockedCCUIServer.mockImplementation(() => mockServer);
  });

  afterEach(() => {
    consoleSpy.log.mockClear();
    consoleSpy.error.mockClear();
    mockExit.mockClear();
    mockOn.mockClear();
  });

  afterAll(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.error.mockRestore();
    mockExit.mockRestore();
    mockOn.mockRestore();
  });

  describe('successful server start', () => {
    beforeEach(() => {
      mockServer.start.mockResolvedValue(undefined);
    });

    it('should start server with default options', async () => {
      const options = {
        port: '3001',
        mcpConfig: './config/mcp-config.json'
      };

      await serveCommand(options);

      expect(MockedCCUIServer).toHaveBeenCalledWith({
        port: 3001,
        mcpConfigPath: './config/mcp-config.json',
        claudeHomePath: undefined
      });

      expect(mockServer.start).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith('Starting CCUI server on port 3001...');
      expect(consoleSpy.log).toHaveBeenCalledWith('CCUI server is running at http://localhost:3001');
    });

    it('should start server with all options provided', async () => {
      const options = {
        port: '8080',
        mcpConfig: '/custom/path/mcp-config.json',
        claudeHome: '/custom/.claude'
      };

      await serveCommand(options);

      expect(MockedCCUIServer).toHaveBeenCalledWith({
        port: 8080,
        mcpConfigPath: '/custom/path/mcp-config.json',
        claudeHomePath: '/custom/.claude'
      });

      expect(mockServer.start).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith('Starting CCUI server on port 8080...');
      expect(consoleSpy.log).toHaveBeenCalledWith('CCUI server is running at http://localhost:8080');
    });

    it('should register SIGTERM handler for graceful shutdown', async () => {
      const options = {
        port: '3001',
        mcpConfig: './config/mcp-config.json'
      };

      await serveCommand(options);

      expect(mockOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('should handle SIGTERM signal correctly', async () => {
      const options = {
        port: '3001',
        mcpConfig: './config/mcp-config.json'
      };

      mockServer.stop.mockResolvedValue(undefined);

      // Capture the SIGTERM handler
      let sigtermHandler: Function;
      mockOn.mockImplementation((signal: string | symbol, handler: any) => {
        if (signal === 'SIGTERM') {
          sigtermHandler = handler;
        }
        return process;
      });

      await serveCommand(options);

      expect(sigtermHandler!).toBeDefined();

      // Simulate SIGTERM
      await sigtermHandler!();

      expect(consoleSpy.log).toHaveBeenCalledWith('\nSIGTERM received, shutting down gracefully...');
      expect(mockServer.stop).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should handle SIGINT signal correctly', async () => {
      const options = {
        port: '3001',
        mcpConfig: './config/mcp-config.json'
      };

      mockServer.stop.mockResolvedValue(undefined);

      // Capture the SIGINT handler
      let sigintHandler: Function;
      mockOn.mockImplementation((signal: string | symbol, handler: any) => {
        if (signal === 'SIGINT') {
          sigintHandler = handler;
        }
        return process;
      });

      await serveCommand(options);

      expect(sigintHandler!).toBeDefined();

      // Simulate SIGINT (Ctrl+C)
      await sigintHandler!();

      expect(consoleSpy.log).toHaveBeenCalledWith('\nSIGINT received, shutting down gracefully...');
      expect(mockServer.stop).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
    });
  });

  describe('server start failure', () => {
    it('should handle server start errors', async () => {
      const startError = new Error('Port already in use');
      mockServer.start.mockRejectedValue(startError);

      const options = {
        port: '3001',
        mcpConfig: './config/mcp-config.json'
      };

      await serveCommand(options);

      expect(consoleSpy.error).toHaveBeenCalledWith('Failed to start server:', startError);
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle server instantiation errors', async () => {
      const constructorError = new Error('Invalid config');
      MockedCCUIServer.mockImplementation(() => {
        throw constructorError;
      });

      const options = {
        port: '3001',
        mcpConfig: './config/mcp-config.json'
      };

      await serveCommand(options);

      expect(consoleSpy.error).toHaveBeenCalledWith('Failed to start server:', constructorError);
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('signal handling edge cases', () => {
    it('should handle server stop errors during SIGTERM', async () => {
      const options = {
        port: '3001',
        mcpConfig: './config/mcp-config.json'
      };

      const stopError = new Error('Failed to stop server');
      mockServer.stop.mockRejectedValue(stopError);

      // Capture the SIGTERM handler
      let sigtermHandler: Function;
      mockOn.mockImplementation((signal: string | symbol, handler: any) => {
        if (signal === 'SIGTERM') {
          sigtermHandler = handler;
        }
        return process;
      });

      await serveCommand(options);

      // Simulate SIGTERM with error in stop
      await sigtermHandler!();

      expect(consoleSpy.log).toHaveBeenCalledWith('\nSIGTERM received, shutting down gracefully...');
      expect(mockServer.stop).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0); // Should still exit even if stop fails
    });

    it('should handle server stop errors during SIGINT', async () => {
      const options = {
        port: '3001',
        mcpConfig: './config/mcp-config.json'
      };

      const stopError = new Error('Failed to stop server');
      mockServer.stop.mockRejectedValue(stopError);

      // Capture the SIGINT handler
      let sigintHandler: Function;
      mockOn.mockImplementation((signal: string | symbol, handler: any) => {
        if (signal === 'SIGINT') {
          sigintHandler = handler;
        }
        return process;
      });

      await serveCommand(options);

      // Simulate SIGINT with error in stop
      await sigintHandler!();

      expect(consoleSpy.log).toHaveBeenCalledWith('\nSIGINT received, shutting down gracefully...');
      expect(mockServer.stop).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0); // Should still exit even if stop fails
    });
  });

  describe('port parsing', () => {
    it('should correctly parse string port to number', async () => {
      const options = {
        port: '9000',
        mcpConfig: './config/mcp-config.json'
      };

      await serveCommand(options);

      expect(MockedCCUIServer).toHaveBeenCalledWith({
        port: 9000,
        mcpConfigPath: './config/mcp-config.json',
        claudeHomePath: undefined
      });
    });

    it('should handle invalid port numbers', async () => {
      // Mock the server constructor to throw an error when given NaN port
      const portError = new Error('Invalid port number');
      MockedCCUIServer.mockImplementation(() => {
        throw portError;
      });

      const options = {
        port: 'invalid-port',
        mcpConfig: './config/mcp-config.json'
      };

      await serveCommand(options);

      // parseInt('invalid-port') returns NaN
      expect(MockedCCUIServer).toHaveBeenCalledWith({
        port: NaN,
        mcpConfigPath: './config/mcp-config.json',
        claudeHomePath: undefined
      });

      // Should exit with error code when constructor throws
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleSpy.error).toHaveBeenCalledWith('Failed to start server:', portError);
    });

    it('should handle port number with whitespace', async () => {
      const options = {
        port: '  3000  ',
        mcpConfig: './config/mcp-config.json'
      };

      await serveCommand(options);

      expect(MockedCCUIServer).toHaveBeenCalledWith({
        port: 3000,
        mcpConfigPath: './config/mcp-config.json',
        claudeHomePath: undefined
      });
    });
  });

  describe('configuration edge cases', () => {
    it('should handle empty MCP config path', async () => {
      const options = {
        port: '3001',
        mcpConfig: ''
      };

      await serveCommand(options);

      expect(MockedCCUIServer).toHaveBeenCalledWith({
        port: 3001,
        mcpConfigPath: '',
        claudeHomePath: undefined
      });
    });

    it('should handle empty Claude home path', async () => {
      const options = {
        port: '3001',
        mcpConfig: './config/mcp-config.json',
        claudeHome: ''
      };

      await serveCommand(options);

      expect(MockedCCUIServer).toHaveBeenCalledWith({
        port: 3001,
        mcpConfigPath: './config/mcp-config.json',
        claudeHomePath: ''
      });
    });
  });
});