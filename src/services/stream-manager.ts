import { Response } from 'express';
import { StreamEvent, CCUIError } from '@/types';
import { EventEmitter } from 'events';

interface ClientConnection {
  response: Response;
  sessionId: string;
  connectedAt: Date;
}

/**
 * Manages streaming connections to multiple clients
 */
export class StreamManager extends EventEmitter {
  private clients: Map<string, Set<Response>> = new Map();
  private clientMetadata: Map<Response, ClientConnection> = new Map();

  /**
   * Add a client to receive stream updates
   */
  addClient(sessionId: string, res: Response): void {
    // Configure response for streaming
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Initialize client set if needed
    if (!this.clients.has(sessionId)) {
      this.clients.set(sessionId, new Set());
    }
    
    // Add this client to the session
    this.clients.get(sessionId)!.add(res);
    this.clientMetadata.set(res, {
      response: res,
      sessionId,
      connectedAt: new Date()
    });
    
    // Send initial connection confirmation
    this.sendToClient(res, {
      type: 'connected',
      session_id: sessionId,
      timestamp: new Date().toISOString()
    });
    
    // Clean up when client disconnects
    res.on('close', () => {
      this.removeClient(sessionId, res);
    });

    res.on('error', (error) => {
      console.error(`Stream error for session ${sessionId}:`, error);
      this.removeClient(sessionId, res);
    });
  }

  /**
   * Remove a client connection
   */
  removeClient(sessionId: string, res: Response): void {
    const clients = this.clients.get(sessionId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        this.clients.delete(sessionId);
      }
    }
    this.clientMetadata.delete(res);
    this.emit('client-disconnected', { sessionId });
  }

  /**
   * Broadcast an event to all clients watching a session
   */
  broadcast(sessionId: string, event: StreamEvent): void {
    const clients = this.clients.get(sessionId);
    if (!clients || clients.size === 0) {
      return;
    }
    
    const deadClients: Response[] = [];
    
    for (const client of clients) {
      try {
        this.sendToClient(client, event);
      } catch (error) {
        console.error(`Failed to send to client:`, error);
        deadClients.push(client);
      }
    }
    
    // Clean up dead clients
    deadClients.forEach(client => this.removeClient(sessionId, client));
  }

  /**
   * Send a message to a specific client
   */
  private sendToClient(res: Response, message: any): void {
    if (res.writableEnded || res.destroyed) {
      throw new Error('Response is no longer writable');
    }
    
    const data = JSON.stringify(message) + '\n';
    res.write(data);
  }

  /**
   * Get number of clients connected to a session
   */
  getClientCount(sessionId: string): number {
    return this.clients.get(sessionId)?.size || 0;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Close all connections for a session
   */
  closeSession(sessionId: string): void {
    const clients = this.clients.get(sessionId);
    if (!clients) return;
    
    const closeEvent: StreamEvent = {
      type: 'closed',
      sessionId,
      timestamp: new Date().toISOString()
    };
    
    for (const client of clients) {
      try {
        this.sendToClient(client, closeEvent);
        client.end();
      } catch (error) {
        console.error(`Error closing client connection:`, error);
      }
    }
    
    this.clients.delete(sessionId);
  }

  /**
   * Get metadata about connected clients
   */
  getClientMetadata(): Array<{ sessionId: string; connectedAt: Date }> {
    return Array.from(this.clientMetadata.values()).map(({ sessionId, connectedAt }) => ({
      sessionId,
      connectedAt
    }));
  }
}