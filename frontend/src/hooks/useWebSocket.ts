/**
 * WEBSOCKET CLIENT HOOK
 * Manages WebSocket connection for real-time research updates
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export interface ResearchUpdate {
  type: 'connected' | 'research_started' | 'research_progress' | 'research_complete' | 'research_error';
  taskId?: string;
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

export interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: ResearchUpdate | null;
  researchingBlocks: Set<string>;
  completedBlocks: Set<string>;
  sendMessage: (message: any) => void;
  connect: () => void;
  disconnect: () => void;
}

const WS_URL = 'ws://localhost:3001/ws';
const RECONNECT_DELAY = 3000; // 3 seconds

export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<ResearchUpdate | null>(null);
  const [researchingBlocks, setResearchingBlocks] = useState<Set<string>>(new Set());
  const [completedBlocks, setCompletedBlocks] = useState<Set<string>>(new Set());

  const connect = useCallback(() => {
    // Don't reconnect if already connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    console.log('[WebSocket] Connecting to', WS_URL);

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected!');
        setIsConnected(true);

        // Clear any reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data: ResearchUpdate = JSON.parse(event.data);
          console.log('[WebSocket] Received:', data.type, data);

          setLastMessage(data);

          // Track researching blocks
          if (data.type === 'research_started' && data.blockId) {
            setResearchingBlocks(prev => new Set(prev).add(data.blockId!));
          }

          // Track completed blocks
          if (data.type === 'research_complete' && data.blockId) {
            setResearchingBlocks(prev => {
              const next = new Set(prev);
              next.delete(data.blockId!);
              return next;
            });
            setCompletedBlocks(prev => new Set(prev).add(data.blockId!));
          }

          // Track errors
          if (data.type === 'research_error' && data.blockId) {
            setResearchingBlocks(prev => {
              const next = new Set(prev);
              next.delete(data.blockId!);
              return next;
            });
          }

        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };

      ws.onclose = () => {
        console.log('[WebSocket] Connection closed');
        setIsConnected(false);
        wsRef.current = null;

        // Auto-reconnect after delay
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[WebSocket] Attempting to reconnect...');
          connect();
        }, RECONNECT_DELAY);
      };

    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error);

      // Retry connection after delay
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, RECONNECT_DELAY);
    }
  }, []);

  const disconnect = useCallback(() => {
    console.log('[WebSocket] Disconnecting...');

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      console.log('[WebSocket] Sent:', message);
    } else {
      console.warn('[WebSocket] Cannot send message - not connected');
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    researchingBlocks,
    completedBlocks,
    sendMessage,
    connect,
    disconnect
  };
}
