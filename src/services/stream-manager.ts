import { Response } from 'express';
import { StreamEvent } from '@/types';
import { EventEmitter } from 'events';
import { createLogger } from './logger';
import type { Logger } from 'pino';

interface ClientConnection {
  response: Response;
  streamingId: string; // CCUI's internal streaming identifier
  connectedAt: Date;
}

interface BufferedMessage {
  event: StreamEvent;
  timestamp: Date;
}

/**
 * Manages streaming connections to multiple clients
 */
export class StreamManager extends EventEmitter {
  private clients: Map<string, Set<Response>> = new Map();
  private clientMetadata: Map<Response, ClientConnection> = new Map();
  private messageBuffer: Map<string, BufferedMessage[]> = new Map();
  private bufferTimeout: Map<string, NodeJS.Timeout> = new Map();
  private logger: Logger;
  
  // Buffer messages for 5 seconds when no clients are connected
  private readonly BUFFER_TIMEOUT_MS = 5000;

  constructor() {
    super();
    this.logger = createLogger('StreamManager');
  }

  /**
   * Add a client to receive stream updates
   */
  addClient(streamingId: string, res: Response): void {
    this.logger.debug('Adding client to stream', { streamingId });
    
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
    
    this.logger.debug('Client added successfully', { 
      streamingId, 
      totalClients: this.clients.get(streamingId)!.size 
    });
    
    // Send initial connection confirmation
    this.sendToClient(res, {
      type: 'connected',
      streaming_id: streamingId,
      timestamp: new Date().toISOString()
    });
    
    // Send any buffered messages for this session
    this.flushBufferedMessages(streamingId, res);
    
    // Clean up when client disconnects
    res.on('close', () => {
      this.removeClient(streamingId, res);
    });

    res.on('error', (error) => {
      this.logger.error('Stream error for session', error, { streamingId });
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
    this.logger.debug('Broadcasting event to clients', { 
      streamingId, 
      eventType: event?.type,
      eventSubtype: (event as any)?.subtype 
    });
    
    const clients = this.clients.get(streamingId);
    if (!clients || clients.size === 0) {
      this.logger.debug('No clients found for streaming session, buffering message', { streamingId });
      this.bufferMessage(streamingId, event);
      return;
    }
    
    this.logger.debug('Found clients for broadcast', { 
      streamingId, 
      clientCount: clients.size 
    });
    
    const deadClients: Response[] = [];
    
    for (const client of clients) {
      try {
        this.sendToClient(client, event);
        this.logger.debug('Successfully sent event to client', { streamingId });
      } catch (error) {
        this.logger.error('Failed to send to client', error, { streamingId });
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
    
    // Create array to avoid modifying set while iterating
    const clientsArray = Array.from(clients);
    
    for (const client of clientsArray) {
      try {
        this.sendToClient(client, closeEvent);
        client.end();
        // Clean up metadata for this client
        this.clientMetadata.delete(client);
      } catch (error) {
        this.logger.error('Error closing client connection', error, { streamingId });
      }
    }
    
    // Remove the entire session
    this.clients.delete(streamingId);
    
    // Clear any buffered messages for this session
    this.messageBuffer.delete(streamingId);
    const timeout = this.bufferTimeout.get(streamingId);
    if (timeout) {
      clearTimeout(timeout);
      this.bufferTimeout.delete(streamingId);
    }
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
    this.clearAllBuffers();
  }

  /**
   * Buffer a message when no clients are connected
   */
  private bufferMessage(streamingId: string, event: StreamEvent): void {
    if (!this.messageBuffer.has(streamingId)) {
      this.messageBuffer.set(streamingId, []);
    }

    const buffer = this.messageBuffer.get(streamingId)!;
    buffer.push({
      event,
      timestamp: new Date()
    });

    // Set up timeout to clear buffer if no clients connect
    if (!this.bufferTimeout.has(streamingId)) {
      const timeout = setTimeout(() => {
        this.logger.debug('Buffer timeout expired, clearing messages', { streamingId });
        this.messageBuffer.delete(streamingId);
        this.bufferTimeout.delete(streamingId);
      }, this.BUFFER_TIMEOUT_MS);
      
      this.bufferTimeout.set(streamingId, timeout);
    }
  }

  /**
   * Flush buffered messages to a newly connected client
   */
  private flushBufferedMessages(streamingId: string, res: Response): void {
    const buffer = this.messageBuffer.get(streamingId);
    if (!buffer || buffer.length === 0) {
      return;
    }

    this.logger.debug('Flushing buffered messages to client', { 
      streamingId, 
      messageCount: buffer.length 
    });

    // Send all buffered messages
    for (const bufferedMessage of buffer) {
      try {
        this.sendToClient(res, bufferedMessage.event);
      } catch (error) {
        this.logger.error('Failed to send buffered message', error, { streamingId });
        break;
      }
    }

    // Clear the buffer after flushing
    this.messageBuffer.delete(streamingId);
    
    // Clear the timeout
    const timeout = this.bufferTimeout.get(streamingId);
    if (timeout) {
      clearTimeout(timeout);
      this.bufferTimeout.delete(streamingId);
    }
  }

  /**
   * Clear all message buffers
   */
  private clearAllBuffers(): void {
    // Clear all timeouts
    for (const timeout of this.bufferTimeout.values()) {
      clearTimeout(timeout);
    }
    
    this.messageBuffer.clear();
    this.bufferTimeout.clear();
  }
}