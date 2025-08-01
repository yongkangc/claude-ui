import crypto from 'crypto';

describe('generateMachineId', () => {
  let generateMachineId: any;
  let osMock: any;
  let execMock: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Create mocks
    osMock = {
      platform: jest.fn(),
      hostname: jest.fn(),
      networkInterfaces: jest.fn()
    };

    execMock = jest.fn();

    // Mock modules before importing
    jest.doMock('os', () => osMock);
    jest.doMock('child_process', () => ({
      exec: execMock
    }));
    jest.doMock('util', () => ({
      promisify: jest.fn((fn) => {
        if (fn === execMock) {
          return (cmd: string) => {
            return new Promise((resolve, reject) => {
              execMock(cmd, (error: Error | null, stdout: string, stderr: string) => {
                if (error) {
                  reject(error);
                } else {
                  resolve({ stdout, stderr });
                }
              });
            });
          };
        }
        return fn;
      })
    }));

    // Import after mocking
    const machineIdModule = require('@/utils/machine-id');
    generateMachineId = machineIdModule.generateMachineId;
  });

  afterEach(() => {
    jest.dontMock('os');
    jest.dontMock('child_process');
    jest.dontMock('util');
  });

  describe('on macOS', () => {
    beforeEach(() => {
      osMock.platform.mockReturnValue('darwin');
      osMock.hostname.mockReturnValue('WenboMacbook');
    });

    it('should generate machine ID with hostname and 16-char MAC hash', async () => {
      const mockMacAddress = 'a1:b2:c3:d4:e5:f6';
      execMock.mockImplementation((cmd, callback) => {
        callback(null, mockMacAddress + '\n', '');
      });

      const machineId = await generateMachineId();

      // Verify hostname is lowercase
      expect(machineId.startsWith('wenbomacbook-')).toBe(true);

      // Extract hash part
      const [hostname, hash] = machineId.split('-');
      expect(hostname).toBe('wenbomacbook');
      expect(hash).toHaveLength(16);

      // Verify hash is first 16 chars of SHA256 of lowercase MAC
      const expectedHash = crypto
        .createHash('sha256')
        .update(mockMacAddress.toLowerCase())
        .digest('hex')
        .substring(0, 16);
      expect(hash).toBe(expectedHash);

      // Verify correct command was used
      expect(execMock).toHaveBeenCalledWith(
        'ifconfig en0 | grep ether | awk \'{print $2}\'',
        expect.any(Function)
      );
    });

    it('should handle different hostname cases', async () => {
      osMock.hostname.mockReturnValue('MyMacBook-Pro');
      execMock.mockImplementation((cmd, callback) => {
        callback(null, 'aa:bb:cc:dd:ee:ff\n', '');
      });

      const machineId = await generateMachineId();
      expect(machineId.startsWith('mymacbook-pro-')).toBe(true);
    });

    it('should sanitize hostnames with dots and special characters', async () => {
      osMock.hostname.mockReturnValue('dedens-kgpwgmw6ft.local');
      execMock.mockImplementation((cmd, callback) => {
        callback(null, 'aa:bb:cc:dd:ee:ff\n', '');
      });

      const machineId = await generateMachineId();
      expect(machineId.startsWith('dedens-kgpwgmw6ftlocal-')).toBe(true);
      
      // Test with more special characters
      osMock.hostname.mockReturnValue('my.host@name#123');
      const machineId2 = await generateMachineId();
      expect(machineId2.startsWith('myhostname123-')).toBe(true);
    });

    it('should fallback to os.networkInterfaces on command failure', async () => {
      execMock.mockImplementation((cmd, callback) => {
        callback(new Error('Command failed'), '', 'error');
      });

      osMock.networkInterfaces.mockReturnValue({
        en0: [
          {
            address: '192.168.1.100',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: '00:11:22:33:44:55',
            internal: false,
            cidr: '192.168.1.100/24'
          }
        ]
      });

      const machineId = await generateMachineId();

      // Verify it used the fallback MAC address
      const expectedHash = crypto
        .createHash('sha256')
        .update('00:11:22:33:44:55'.toLowerCase())
        .digest('hex')
        .substring(0, 16);
      expect(machineId).toBe(`wenbomacbook-${expectedHash}`);
    });
  });

  describe('on Linux', () => {
    beforeEach(() => {
      osMock.platform.mockReturnValue('linux');
      osMock.hostname.mockReturnValue('ubuntu-server');
    });

    it('should generate machine ID on Linux', async () => {
      const mockMacAddress = 'f1:e2:d3:c4:b5:a6';
      execMock.mockImplementation((cmd, callback) => {
        callback(null, mockMacAddress + '\n', '');
      });

      const machineId = await generateMachineId();

      expect(machineId.startsWith('ubuntu-server-')).toBe(true);
      // Extract hash after the hostname (accounting for hyphens in hostname)
      const hash = machineId.substring('ubuntu-server-'.length);
      expect(hash).toHaveLength(16);

      // Verify correct Linux command was used
      expect(execMock).toHaveBeenCalledWith(
        'ip link show | grep -E "eno1|eth0|enp0s[0-9]+" -A1 | grep link/ether | head -1 | awk \'{print $2}\'',
        expect.any(Function)
      );
    });
  });

  describe('on Windows', () => {
    beforeEach(() => {
      osMock.platform.mockReturnValue('win32');
      osMock.hostname.mockReturnValue('DESKTOP-ABC123');
    });

    it('should generate machine ID on Windows', async () => {
      const mockMacAddress = 'A1-B2-C3-D4-E5-F6';
      execMock.mockImplementation((cmd, callback) => {
        callback(null, mockMacAddress + '\n', '');
      });

      const machineId = await generateMachineId();

      expect(machineId.startsWith('desktop-abc123-')).toBe(true);
      // Extract hash after the hostname (accounting for hyphens in hostname)
      const hash = machineId.substring('desktop-abc123-'.length);
      expect(hash).toHaveLength(16);

      // Verify correct Windows command was used
      expect(execMock).toHaveBeenCalledWith(
        'wmic nic where "PhysicalAdapter=TRUE" get MACAddress | findstr /r "[0-9A-F][0-9A-F]:[0-9A-F][0-9A-F]" | head -1',
        expect.any(Function)
      );
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      osMock.platform.mockReturnValue('darwin');
      osMock.hostname.mockReturnValue('test-machine');
    });

    it('should skip internal interfaces in fallback', async () => {
      execMock.mockImplementation((cmd, callback) => {
        callback(new Error('Command failed'), '', '');
      });

      osMock.networkInterfaces.mockReturnValue({
        lo0: [
          {
            address: '127.0.0.1',
            netmask: '255.0.0.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            internal: true,
            cidr: '127.0.0.1/8'
          }
        ],
        en0: [
          {
            address: '192.168.1.100',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: 'aa:bb:cc:dd:ee:ff',
            internal: false,
            cidr: '192.168.1.100/24'
          }
        ]
      });

      const machineId = await generateMachineId();

      // Should use en0, not lo0
      const expectedHash = crypto
        .createHash('sha256')
        .update('aa:bb:cc:dd:ee:ff'.toLowerCase())
        .digest('hex')
        .substring(0, 16);
      expect(machineId).toBe(`test-machine-${expectedHash}`);
    });

    it('should throw error when no MAC address is available', async () => {
      execMock.mockImplementation((cmd, callback) => {
        callback(new Error('Command failed'), '', '');
      });

      osMock.networkInterfaces.mockReturnValue({
        lo0: [
          {
            address: '127.0.0.1',
            netmask: '255.0.0.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            internal: true,
            cidr: '127.0.0.1/8'
          }
        ]
      });

      await expect(generateMachineId()).rejects.toThrow('Unable to determine MAC address');
    });

    it('should throw error for unsupported platform', async () => {
      osMock.platform.mockReturnValue('freebsd');
      
      // When platform is unsupported, the function will try networkInterfaces fallback
      // We need to make that fail too
      osMock.networkInterfaces.mockReturnValue({});

      // The actual error will be "Unable to determine MAC address" because
      // the unsupported platform error is caught and falls back to networkInterfaces
      await expect(generateMachineId()).rejects.toThrow('Unable to determine MAC address');
    });

    it('should handle empty command output', async () => {
      execMock.mockImplementation((cmd, callback) => {
        callback(null, '', '');
      });

      osMock.networkInterfaces.mockReturnValue({
        eth0: [
          {
            address: '10.0.0.1',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: '11:22:33:44:55:66',
            internal: false,
            cidr: '10.0.0.1/24'
          }
        ]
      });

      const machineId = await generateMachineId();

      // Should fallback to network interfaces
      const expectedHash = crypto
        .createHash('sha256')
        .update('11:22:33:44:55:66'.toLowerCase())
        .digest('hex')
        .substring(0, 16);
      expect(machineId).toBe(`test-machine-${expectedHash}`);
    });
  });

  describe('hash consistency', () => {
    beforeEach(() => {
      osMock.platform.mockReturnValue('darwin');
      osMock.hostname.mockReturnValue('test-host');
    });

    it('should generate consistent hash for same MAC address', async () => {
      const mockMacAddress = 'aa:bb:cc:dd:ee:ff';
      execMock.mockImplementation((cmd, callback) => {
        callback(null, mockMacAddress, '');
      });

      const id1 = await generateMachineId();
      const id2 = await generateMachineId();

      expect(id1).toBe(id2);
    });

    it('should generate different hashes for different MAC addresses', async () => {
      osMock.hostname.mockReturnValue('samehost');

      execMock.mockImplementationOnce((cmd, callback) => {
        callback(null, 'aa:bb:cc:dd:ee:ff', '');
      });
      const id1 = await generateMachineId();

      execMock.mockImplementationOnce((cmd, callback) => {
        callback(null, '11:22:33:44:55:66', '');
      });
      const id2 = await generateMachineId();

      // Same hostname but different hashes
      const [hostname1, hash1] = id1.split('-');
      const [hostname2, hash2] = id2.split('-');
      expect(hostname1).toBe(hostname2);
      expect(hostname1).toBe('samehost');
      expect(hash1).not.toBe(hash2);
      expect(hash1).toHaveLength(16);
      expect(hash2).toHaveLength(16);
    });

    it('should normalize MAC address case', async () => {
      execMock.mockImplementationOnce((cmd, callback) => {
        callback(null, 'AA:BB:CC:DD:EE:FF', '');
      });
      const id1 = await generateMachineId();

      execMock.mockImplementationOnce((cmd, callback) => {
        callback(null, 'aa:bb:cc:dd:ee:ff', '');
      });
      const id2 = await generateMachineId();

      expect(id1).toBe(id2);
    });
  });
});