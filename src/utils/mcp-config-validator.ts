import * as fs from 'fs/promises';
import * as path from 'path';
import { CCUIError } from '@/types';
import { z } from 'zod';

// Schema for MCP configuration file
const MCPServerConfigSchema = z.object({
  command: z.string().min(1, 'Command is required'),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  cwd: z.string().optional()
});

const MCPConfigSchema = z.object({
  mcpServers: z.record(z.string(), MCPServerConfigSchema)
});

export interface MCPConfig {
  mcpServers: Record<string, {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
  }>;
}

/**
 * Validates MCP configuration file
 */
export class MCPConfigValidator {
  /**
   * Validate MCP configuration file exists and has correct structure
   */
  static async validateConfig(configPath: string): Promise<MCPConfig> {
    try {
      // Check if file exists
      const resolvedPath = path.resolve(configPath);
      
      try {
        await fs.access(resolvedPath, fs.constants.F_OK);
      } catch (error) {
        throw new CCUIError(
          'MCP_CONFIG_NOT_FOUND',
          `MCP configuration file not found: ${resolvedPath}`,
          400
        );
      }

      // Read and parse the file
      let configContent: string;
      try {
        configContent = await fs.readFile(resolvedPath, 'utf-8');
      } catch (error) {
        throw new CCUIError(
          'MCP_CONFIG_READ_ERROR',
          `Failed to read MCP configuration file: ${error}`,
          400
        );
      }

      // Parse JSON
      let parsedConfig: any;
      try {
        parsedConfig = JSON.parse(configContent);
      } catch (error) {
        throw new CCUIError(
          'MCP_CONFIG_INVALID_JSON',
          `MCP configuration file contains invalid JSON: ${error}`,
          400
        );
      }

      // Validate schema
      try {
        const validatedConfig = MCPConfigSchema.parse(parsedConfig);
        return validatedConfig;
      } catch (error) {
        if (error instanceof z.ZodError) {
          const issues = error.issues.map(issue => 
            `${issue.path.join('.')}: ${issue.message}`
          ).join(', ');
          throw new CCUIError(
            'MCP_CONFIG_INVALID_SCHEMA',
            `MCP configuration file has invalid structure: ${issues}`,
            400
          );
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof CCUIError) {
        throw error;
      }
      throw new CCUIError(
        'MCP_CONFIG_VALIDATION_ERROR',
        `Unexpected error validating MCP configuration: ${error}`,
        500
      );
    }
  }

  /**
   * Check if MCP server executable exists and is accessible
   */
  static async validateServerExecutable(serverConfig: MCPConfig['mcpServers'][string]): Promise<boolean> {
    try {
      // For Node.js servers, check if the script file exists
      if (serverConfig.command === 'node' && serverConfig.args && serverConfig.args.length > 0) {
        const scriptPath = serverConfig.args[0];
        const resolvedPath = path.resolve(scriptPath);
        
        try {
          await fs.access(resolvedPath, fs.constants.F_OK);
          return true;
        } catch (error) {
          return false;
        }
      }

      // For other commands, we can't easily validate without executing
      // so we'll assume they're valid if the command name is provided
      return serverConfig.command.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the absolute path for MCP config relative to current working directory
   */
  static resolveMCPConfigPath(configPath: string): string {
    return path.resolve(configPath);
  }

  /**
   * Validate all servers in the MCP configuration
   */
  static async validateAllServers(config: MCPConfig): Promise<{ 
    valid: Record<string, boolean>; 
    errors: Record<string, string> 
  }> {
    const valid: Record<string, boolean> = {};
    const errors: Record<string, string> = {};

    for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
      try {
        const isValid = await this.validateServerExecutable(serverConfig);
        valid[serverName] = isValid;
        
        if (!isValid) {
          errors[serverName] = `Server executable not accessible: ${serverConfig.command} ${serverConfig.args?.join(' ') || ''}`;
        }
      } catch (error) {
        valid[serverName] = false;
        errors[serverName] = `Validation error: ${error}`;
      }
    }

    return { valid, errors };
  }
}