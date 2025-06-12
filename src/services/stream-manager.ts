import { Response } from 'express';
import { StreamEvent } from '@/types';
import { EventEmitter } from 'events';

interface ClientConnection {
  response: Response;
  streamingId: string; // CCUI's internal streaming identifier
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
  addClient(streamingId: string, res: Response): void {
    // Configure response for streaming
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Initialize client set if needed
    if (!this.clients.has(streamingId)) {
      this.clients.set(streamingId, new Set());
    }
    
    // Add this client to the session
    this.clients.get(streamingId)!.add(res);
    this.clientMetadata.set(res, {
      response: res,
      streamingId,
      connectedAt: new Date()
    });
    
    // Send initial connection confirmation
    this.sendToClient(res, {
      type: 'connected',
      streaming_id: streamingId,
      timestamp: new Date().toISOString()
    });
    
    // Clean up when client disconnects
    res.on('close', () => {
      this.removeClient(streamingId, res);
    });

    res.on('error', (error) => {
      console.error(`Stream error for session ${streamingId}:`, error);
      this.removeClient(streamingId, res);
    });
  }

  /**
   * Remove a client connection
   */
  removeClient(streamingId: string, res: Response): void {
    const clients = this.clients.get(streamingId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        this.clients.delete(streamingId);
      }
    }
    this.clientMetadata.delete(res);
    this.emit('client-disconnected', { streamingId });
  }

  /**
   * Broadcast an event to all clients watching a session
   */
  broadcast(streamingId: string, event: StreamEvent): void {
    const clients = this.clients.get(streamingId);
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
    deadClients.forEach(client => this.removeClient(streamingId, client));
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
  getClientCount(streamingId: string): number {
    return this.clients.get(streamingId)?.size || 0;
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
  closeSession(streamingId: string): void {
    const clients = this.clients.get(streamingId);
    if (!clients) return;
    
    const closeEvent: StreamEvent = {
      type: 'closed',
      streamingId: streamingId,
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
    
    this.clients.delete(streamingId);
  }

  /**
   * Get metadata about connected clients
   */
  getClientMetadata(): Array<{ streamingId: string; connectedAt: Date }> {
    return Array.from(this.clientMetadata.values()).map(({ streamingId, connectedAt }) => ({
      streamingId,
      connectedAt
    }));
  }

  /**
   * Disconnect all clients from all sessions
   */
  disconnectAll(): void {
    for (const streamingId of this.clients.keys()) {
      this.closeSession(streamingId);
    }
    this.clientMetadata.clear();
  }
}