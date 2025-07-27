// Mock the logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

jest.mock('@/services/logger', () => ({
  createLogger: () => mockLogger
}));

describe('CommandsService', () => {
  let fs: any;
  let os: any;
  let getBuiltinCommands: () => any[];
  let getCustomCommands: (workingDirectory?: string) => any[];
  let getAvailableCommands: (workingDirectory?: string) => any[];

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    
    // Set up mocks before importing
    jest.doMock('fs', () => ({
      existsSync: jest.fn(),
      readdirSync: jest.fn()
    }));
    
    jest.doMock('os', () => ({
      homedir: jest.fn().mockReturnValue('/home/user')
    }));

    // Import after mocking
    fs = require('fs');
    os = require('os');
    const commandsService = require('@/services/commands-service');
    getBuiltinCommands = commandsService.getBuiltinCommands;
    getCustomCommands = commandsService.getCustomCommands;
    getAvailableCommands = commandsService.getAvailableCommands;
  });

  afterEach(() => {
    jest.dontMock('fs');
    jest.dontMock('os');
  });

  describe('getBuiltinCommands', () => {
    it('should return all hardcoded builtin commands', () => {
      const commands = getBuiltinCommands();
      
      expect(commands).toHaveLength(6);
      expect(commands).toEqual([
        { name: '/add-dir', type: 'builtin', description: 'Add a new working directory' },
        { name: '/clear', type: 'builtin', description: 'Clear conversation history and free up context' },
        { name: '/compact', type: 'builtin', description: 'Clear conversation history but keep a summary in context' },
        { name: '/init', type: 'builtin', description: 'Initialize a new CLAUDE.md file with codebase documentation' },
        { name: '/model', type: 'builtin', description: 'Set the AI model for Claude Code' },
        { name: '/permissions', type: 'builtin', description: 'Manage allow & deny tool permission rules' }
      ]);
    });

    it('should always return the same commands', () => {
      const commands1 = getBuiltinCommands();
      const commands2 = getBuiltinCommands();
      
      expect(commands1).toEqual(commands2);
    });
  });

  describe('getCustomCommands', () => {
    describe('without working directory', () => {
      it('should return empty array when global commands directory does not exist', () => {
        fs.existsSync.mockReturnValue(false);
        
        const commands = getCustomCommands();
        
        expect(commands).toEqual([]);
        expect(fs.existsSync).toHaveBeenCalledWith('/home/user/.claude/commands');
        expect(fs.readdirSync).not.toHaveBeenCalled();
      });

      it('should return commands from global directory when it exists', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockReturnValue(['test.md', 'deploy.md', 'readme.txt']);
        
        const commands = getCustomCommands();
        
        expect(commands).toEqual([
          { name: '/test', type: 'custom' },
          { name: '/deploy', type: 'custom' }
        ]);
        expect(fs.existsSync).toHaveBeenCalledWith('/home/user/.claude/commands');
        expect(fs.readdirSync).toHaveBeenCalledWith('/home/user/.claude/commands');
      });

      it('should handle empty global commands directory', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockReturnValue([]);
        
        const commands = getCustomCommands();
        
        expect(commands).toEqual([]);
      });

      it('should filter out non-.md files', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockReturnValue(['test.md', 'script.js', 'deploy.md', '.gitignore', 'README']);
        
        const commands = getCustomCommands();
        
        expect(commands).toEqual([
          { name: '/test', type: 'custom' },
          { name: '/deploy', type: 'custom' }
        ]);
      });

      it('should handle read errors gracefully', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockImplementation(() => {
          throw new Error('Permission denied');
        });
        
        const commands = getCustomCommands();
        
        expect(commands).toEqual([]);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Failed to read global commands directory',
          {
            error: 'Permission denied',
            path: '/home/user/.claude/commands'
          }
        );
      });
    });

    describe('with working directory', () => {
      const workingDir = '/project/dir';

      it('should check both global and local directories', () => {
        fs.existsSync.mockReturnValue(false);
        
        const commands = getCustomCommands(workingDir);
        
        expect(commands).toEqual([]);
        expect(fs.existsSync).toHaveBeenCalledWith('/home/user/.claude/commands');
        expect(fs.existsSync).toHaveBeenCalledWith('/project/dir/.claude/commands');
      });

      it('should merge commands from global and local directories', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync
          .mockReturnValueOnce(['test.md', 'deploy.md']) // global
          .mockReturnValueOnce(['build.md', 'lint.md']); // local
        
        const commands = getCustomCommands(workingDir);
        
        expect(commands).toEqual([
          { name: '/test', type: 'custom' },
          { name: '/deploy', type: 'custom' },
          { name: '/build', type: 'custom' },
          { name: '/lint', type: 'custom' }
        ]);
      });

      it('should let local commands override global ones', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync
          .mockReturnValueOnce(['test.md', 'deploy.md']) // global
          .mockReturnValueOnce(['test.md', 'build.md']); // local (test.md overrides global)
        
        const commands = getCustomCommands(workingDir);
        
        // Should have 3 commands, not 4, because local /test overrides global /test
        expect(commands).toHaveLength(3);
        
        // Check that the commands array contains the expected commands (order doesn't matter)
        const commandNames = commands.map((cmd: any) => cmd.name);
        expect(commandNames).toContain('/deploy');
        expect(commandNames).toContain('/test');
        expect(commandNames).toContain('/build');
        
        // Verify all are custom type
        expect(commands.every((cmd: any) => cmd.type === 'custom')).toBe(true);
      });

      it('should handle when only local directory exists', () => {
        fs.existsSync
          .mockReturnValueOnce(false) // global doesn't exist
          .mockReturnValueOnce(true); // local exists
        fs.readdirSync.mockReturnValue(['local-cmd.md']);
        
        const commands = getCustomCommands(workingDir);
        
        expect(commands).toEqual([
          { name: '/local-cmd', type: 'custom' }
        ]);
      });

      it('should handle when only global directory exists', () => {
        fs.existsSync
          .mockReturnValueOnce(true) // global exists
          .mockReturnValueOnce(false); // local doesn't exist
        fs.readdirSync.mockReturnValue(['global-cmd.md']);
        
        const commands = getCustomCommands(workingDir);
        
        expect(commands).toEqual([
          { name: '/global-cmd', type: 'custom' }
        ]);
      });

      it('should handle local directory read errors gracefully', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync
          .mockReturnValueOnce(['test.md']) // global succeeds
          .mockImplementationOnce(() => {
            throw new Error('Access denied');
          }); // local fails
        
        const commands = getCustomCommands(workingDir);
        
        expect(commands).toEqual([
          { name: '/test', type: 'custom' }
        ]);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Failed to read local commands directory',
          {
            error: 'Access denied',
            path: '/project/dir/.claude/commands'
          }
        );
      });

      it('should handle both directories failing gracefully', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockImplementation(() => {
          throw new Error('Read error');
        });
        
        const commands = getCustomCommands(workingDir);
        
        expect(commands).toEqual([]);
        expect(mockLogger.warn).toHaveBeenCalledTimes(2);
      });

      it('should handle non-Error exceptions', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockImplementation(() => {
          throw 'String error';
        });
        
        const commands = getCustomCommands(workingDir);
        
        expect(commands).toEqual([]);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Failed to read global commands directory',
          {
            error: 'String error',
            path: '/home/user/.claude/commands'
          }
        );
      });
    });
  });

  describe('getAvailableCommands', () => {
    it('should return only builtin commands when no custom commands exist', () => {
      fs.existsSync.mockReturnValue(false);
      
      const commands = getAvailableCommands();
      
      expect(commands).toHaveLength(6);
      expect(commands.every((cmd: any) => cmd.type === 'builtin')).toBe(true);
    });

    it('should merge builtin and custom commands', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['test.md', 'deploy.md']);
      
      const commands = getAvailableCommands();
      
      expect(commands).toHaveLength(8);
      expect(commands.filter((cmd: any) => cmd.type === 'builtin')).toHaveLength(6);
      expect(commands.filter((cmd: any) => cmd.type === 'custom')).toHaveLength(2);
    });

    it('should merge builtin and custom commands with working directory', () => {
      const workingDir = '/project/dir';
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync
        .mockReturnValueOnce(['global.md'])
        .mockReturnValueOnce(['local.md']);
      
      const commands = getAvailableCommands(workingDir);
      
      expect(commands).toHaveLength(8);
      expect(commands.filter((cmd: any) => cmd.type === 'builtin')).toHaveLength(6);
      expect(commands.filter((cmd: any) => cmd.type === 'custom')).toHaveLength(2);
      expect(commands.map((cmd: any) => cmd.name)).toContain('/global');
      expect(commands.map((cmd: any) => cmd.name)).toContain('/local');
    });

    it('should preserve order with builtin commands first', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['custom1.md', 'custom2.md']);
      
      const commands = getAvailableCommands();
      
      // First 6 should be builtin
      expect(commands.slice(0, 6).every((cmd: any) => cmd.type === 'builtin')).toBe(true);
      // Last 2 should be custom
      expect(commands.slice(6).every((cmd: any) => cmd.type === 'custom')).toBe(true);
    });

    it('should handle custom commands with similar names to builtin', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['clear.md', 'model.md', 'custom.md']);
      
      const commands = getAvailableCommands();
      
      // Should have both builtin and custom versions
      const clearCommands = commands.filter((cmd: any) => cmd.name === '/clear');
      const modelCommands = commands.filter((cmd: any) => cmd.name === '/model');
      const customCommands = commands.filter((cmd: any) => cmd.name === '/custom');
      
      expect(clearCommands).toHaveLength(2);
      expect(clearCommands.some((cmd: any) => cmd.type === 'builtin')).toBe(true);
      expect(clearCommands.some((cmd: any) => cmd.type === 'custom')).toBe(true);
      
      expect(modelCommands).toHaveLength(2);
      expect(modelCommands.some((cmd: any) => cmd.type === 'builtin')).toBe(true);
      expect(modelCommands.some((cmd: any) => cmd.type === 'custom')).toBe(true);
      
      expect(customCommands).toHaveLength(1);
      expect(customCommands[0].type).toBe('custom');
    });
  });
});