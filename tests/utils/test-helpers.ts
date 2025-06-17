import { CCUIServer } from '@/ccui-server';
import { ClaudeProcessManager } from '@/services/claude-process-manager';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Test utilities for isolated testing environment
 */
export class TestHelpers {
  /**
   * Create a test server with isolated configuration
   */
  static createTestServer(config?: {
    port?: number;
  }): CCUIServer {
    return new CCUIServer({
      port: config?.port || 0
    });
  }

  /**
   * Create a test process manager
   */
  static createTestProcessManager(): ClaudeProcessManager {
    const manager = new ClaudeProcessManager();
    
    
    return manager;
  }

  /**
   * Setup test logging
   */
  static setupTestLogging(enabled: boolean = true): void {
    if (enabled) {
      // Enable debug logging by setting environment variables
      process.env.LOG_LEVEL = 'debug';
      process.env.DEBUG = 'ccui:*';
    } else {
      delete process.env.LOG_LEVEL;
      delete process.env.DEBUG;
    }
  }

  /**
   * Wait for a condition to be met with timeout
   */
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeoutMs: number = 5000,
    intervalMs: number = 100
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const result = await condition();
      if (result) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    
    throw new Error(`Condition not met within ${timeoutMs}ms`);
  }

  /**
   * Override environment variables for a specific test scope
   */
  static withEnvironment<T>(
    envVars: Record<string, string>, 
    fn: () => T | Promise<T>
  ): T | Promise<T> {
    const originalEnv = { ...process.env };
    
    // Set test environment variables
    Object.assign(process.env, envVars);
    
    try {
      const result = fn();
      
      // Handle both sync and async functions
      if (result instanceof Promise) {
        return result.finally(() => {
          // Restore original environment
          Object.keys(process.env).forEach(key => {
            if (!(key in originalEnv)) {
              delete process.env[key];
            }
          });
          Object.assign(process.env, originalEnv);
        });
      } else {
        // Restore original environment for sync functions
        Object.keys(process.env).forEach(key => {
          if (!(key in originalEnv)) {
            delete process.env[key];
          }
        });
        Object.assign(process.env, originalEnv);
        return result;
      }
    } catch (error) {
      // Restore original environment on error
      Object.keys(process.env).forEach(key => {
        if (!(key in originalEnv)) {
          delete process.env[key];
        }
      });
      Object.assign(process.env, originalEnv);
      throw error;
    }
  }
}