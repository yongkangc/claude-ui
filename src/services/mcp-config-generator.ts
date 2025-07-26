import { writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/services/logger';

export interface MCPConfig {
  mcpServers: {
    [key: string]: {
      command: string;
      args: string[];
      env?: Record<string, string>;
    };
  };
}

/**
 * Generates and writes MCP configuration file
 */
export class MCPConfigGenerator {
  private configPath: string;

  constructor() {
    // Generate unique config file in temp directory
    const tempDir = tmpdir();
    const configFileName = `cui-mcp-config-${uuidv4()}.json`;
    this.configPath = join(tempDir, configFileName);
  }

  /**
   * Generate MCP config with the permission server
   */
  generateConfig(port: number): string {
    // In production/compiled code, __dirname will be in dist/services
    // We need to go up to dist and then to mcp-server
    const isCompiled = __dirname.includes('dist');
    const mcpServerPath = isCompiled 
      ? join(__dirname, '..', 'mcp-server', 'index.js')
      : join(__dirname, '..', '..', 'dist', 'mcp-server', 'index.js');
    
    const config: MCPConfig = {
      mcpServers: {
        'cui-permissions': {
          command: 'node',
          args: [mcpServerPath],
          env: {
            CUI_SERVER_URL: `http://localhost:${port}`,
            CUI_SERVER_PORT: String(port),
            LOG_LEVEL: process.env.LOG_LEVEL || 'info'
          }
        }
      }
    };

    // Ensure directory exists
    mkdirSync(dirname(this.configPath), { recursive: true });

    // Write config file
    writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    
    logger.info('MCP config file generated', {
      path: this.configPath,
      port,
      mcpServerPath
    });

    logger.debug('MCP config file', { config });

    return this.configPath;
  }

  /**
   * Get the path to the generated config file
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Clean up the config file (for shutdown)
   */
  cleanup(): void {
    try {
      unlinkSync(this.configPath);
      logger.debug('MCP config file cleaned up', { path: this.configPath });
    } catch (error) {
      logger.warn('Failed to clean up MCP config file', {
        path: this.configPath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}