import { serveCommand } from '@/cli/commands/serve';
import { CCUIServer } from '@/ccui-server';
import { createLogger } from '@/services/logger';

// Mock CCUIServer
jest.mock('@/ccui-server');

// Mock logger
jest.mock('@/services/logger');

const MockedCCUIServer = CCUIServer as jest.MockedClass<typeof CCUIServer>;
const mockCreateLogger = createLogger as jest.MockedFunction<typeof createLogger>;

// Mock logger instance
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

// Mock process methods
const mockExit = jest.spyOn(process, 'exit').mockImplementation();
const mockOn = jest.spyOn(process, 'on').mockImplementation();

describe('CLI Serve Command', () => {
  let mockServer: jest.Mocked<CCUIServer>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup logger mock
    mockCreateLogger.mockReturnValue(mockLogger as any);
    
    // Create mock server instance
    mockServer = {
      start: jest.fn(),
      stop: jest.fn()
    } as any;
    
    MockedCCUIServer.mockImplementation(() => mockServer);
  });

  afterEach(() => {
    Object.values(mockLogger).forEach(fn => fn.mockClear());
    mockExit.mockClear();
    mockOn.mockClear();
  });

  afterAll(() => {
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
      };

      await serveCommand(options);

      expect(MockedCCUIServer).toHaveBeenCalledWith({
        port: 3001
      });

      expect(mockServer.start).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Starting CCUI server on port 3001');
      expect(mockLogger.info).toHaveBeenCalledWith('CCUI server is running at http://localhost:3001');
    });

    it('should start server with custom port', async () => {
      const options = {
        port: '8080'
      };

      await serveCommand(options);

      expect(MockedCCUIServer).toHaveBeenCalledWith({
        port: 8080
      });

      expect(mockServer.start).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Starting CCUI server on port 8080');
      expect(mockLogger.info).toHaveBeenCalledWith('CCUI server is running at http://localhost:8080');
    });

    it('should register SIGTERM handler for graceful shutdown', async () => {
      const options = {
        port: '3001',
      };

      await serveCommand(options);

      expect(mockOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('should handle SIGTERM signal correctly', async () => {
      const options = {
        port: '3001',
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

      expect(mockLogger.info).toHaveBeenCalledWith('SIGTERM received, shutting down gracefully');
      expect(mockServer.stop).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should handle SIGINT signal correctly', async () => {
      const options = {
        port: '3001',
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

      expect(mockLogger.info).toHaveBeenCalledWith('SIGINT received, shutting down gracefully');
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
      };

      await serveCommand(options);

      expect(mockLogger.fatal).toHaveBeenCalledWith('Failed to start server', startError);
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle server instantiation errors', async () => {
      MockedCCUIServer.mockImplementation(() => {
        throw new Error('Invalid config');
      });

      const options = {
        port: '3001',
      };

      await serveCommand(options);

      expect(mockLogger.fatal).toHaveBeenCalledWith('Failed to start server', expect.any(Error));
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('signal handling edge cases', () => {
    it('should handle server stop errors during SIGTERM', async () => {
      const options = {
        port: '3001',
      };

      mockServer.stop.mockRejectedValue(new Error('Failed to stop server'));

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

      expect(mockLogger.info).toHaveBeenCalledWith('SIGTERM received, shutting down gracefully');
      expect(mockServer.stop).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0); // Should still exit even if stop fails
    });

    it('should handle server stop errors during SIGINT', async () => {
      const options = {
        port: '3001',
      };

      mockServer.stop.mockRejectedValue(new Error('Failed to stop server'));

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

      expect(mockLogger.info).toHaveBeenCalledWith('SIGINT received, shutting down gracefully');
      expect(mockServer.stop).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0); // Should still exit even if stop fails
    });
  });

  describe('port parsing', () => {
    it('should correctly parse string port to number', async () => {
      const options = {
        port: '9000',
      };

      await serveCommand(options);

      expect(MockedCCUIServer).toHaveBeenCalledWith({
        port: 9000
      });
    });

    it('should handle invalid port numbers', async () => {
      // Mock the server constructor to throw an error when given NaN port
      MockedCCUIServer.mockImplementation(() => {
        throw new Error('Invalid port number');
      });

      const options = {
        port: 'invalid-port',
      };

      await serveCommand(options);

      // parseInt('invalid-port') returns NaN
      expect(MockedCCUIServer).toHaveBeenCalledWith({
        port: NaN
      });

      // Should exit with error code when constructor throws
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockLogger.fatal).toHaveBeenCalledWith('Failed to start server', expect.any(Error));
    });

    it('should handle port number with whitespace', async () => {
      const options = {
        port: '  3000  ',
      };

      await serveCommand(options);

      expect(MockedCCUIServer).toHaveBeenCalledWith({
        port: 3000
      });
    });
  });

  describe('configuration edge cases', () => {
    it('should handle default configuration', async () => {
      const options = {
        port: '3001'
      };

      await serveCommand(options);

      expect(MockedCCUIServer).toHaveBeenCalledWith({
        port: 3001
      });
    });
  });
});