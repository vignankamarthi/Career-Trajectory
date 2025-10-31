/**
 * RESEARCH WEBSOCKET SERVER
 * Real-time updates for async research tasks
 */

import { WebSocket, WebSocketServer } from 'ws';
import { Server as HTTPServer } from 'http';
import { Logger } from '../utils/logger';

export interface ResearchUpdate {
  type: 'research_started' | 'research_progress' | 'research_complete' | 'research_error';
  taskId: string;
  blockId?: string;
  blockTitle?: string;
  processor?: string;
  estimatedTime?: number;
  progress?: number;
  message?: string;
  results?: any;
  error?: string;
  timestamp: string;
}

export class ResearchWebSocketServer {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor(server: HTTPServer) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      Logger.info('[WebSocket] Client connected');
      this.clients.add(ws);

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          Logger.info('[WebSocket] Received message', { data });

          // Handle client messages if needed
          if (data.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          }
        } catch (error) {
          Logger.error('[WebSocket] Error parsing message', error);
        }
      });

      ws.on('close', () => {
        Logger.info('[WebSocket] Client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        Logger.error('[WebSocket] Client error', error);
        this.clients.delete(ws);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to Career Trajectory research updates',
        timestamp: new Date().toISOString()
      }));
    });

    Logger.info('[WebSocket] Server initialized on /ws');
  }

  /**
   * Notify all clients that research has started
   */
  notifyResearchStarted(params: {
    taskId: string;
    blockId: string;
    blockTitle: string;
    processor: string;
    estimatedTime: number;
  }): void {
    const update: ResearchUpdate = {
      type: 'research_started',
      ...params,
      message: `Researching "${params.blockTitle}"...`,
      timestamp: new Date().toISOString()
    };

    this.broadcast(update);
    Logger.info('[WebSocket] Notified research started', { taskId: params.taskId });
  }

  /**
   * Notify all clients of research progress
   */
  notifyResearchProgress(params: {
    taskId: string;
    progress: number;
    message?: string;
  }): void {
    const update: ResearchUpdate = {
      type: 'research_progress',
      ...params,
      timestamp: new Date().toISOString()
    };

    this.broadcast(update);
    Logger.info('[WebSocket] Notified research progress', { taskId: params.taskId, progress: params.progress });
  }

  /**
   * Notify all clients that research is complete
   */
  notifyResearchComplete(taskId: string, results: any): void {
    const update: ResearchUpdate = {
      type: 'research_complete',
      taskId,
      results,
      message: 'Research complete',
      timestamp: new Date().toISOString()
    };

    this.broadcast(update);
    Logger.info('[WebSocket] Notified research complete', { taskId });
  }

  /**
   * Notify all clients of research error
   */
  notifyResearchError(taskId: string, error: string): void {
    const update: ResearchUpdate = {
      type: 'research_error',
      taskId,
      error,
      message: 'Research failed',
      timestamp: new Date().toISOString()
    };

    this.broadcast(update);
    Logger.error('[WebSocket] Notified research error', new Error(error), { taskId });
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(data: ResearchUpdate): void {
    const message = JSON.stringify(data);

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          Logger.error('[WebSocket] Error sending to client', error);
        }
      }
    });

    Logger.info('[WebSocket] Broadcasted to clients', {
      type: data.type,
      taskId: data.taskId,
      clientCount: this.clients.size
    });
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Close all connections and shut down server
   */
  close(): void {
    this.clients.forEach((client) => {
      client.close();
    });
    this.wss.close();
    Logger.info('[WebSocket] Server closed');
  }
}

// Singleton instance
let wsServer: ResearchWebSocketServer | null = null;

export function initializeWebSocketServer(server: HTTPServer): ResearchWebSocketServer {
  if (!wsServer) {
    wsServer = new ResearchWebSocketServer(server);
  }
  return wsServer;
}

export function getWebSocketServer(): ResearchWebSocketServer {
  if (!wsServer) {
    throw new Error('WebSocket server not initialized. Call initializeWebSocketServer first.');
  }
  return wsServer;
}
