// Lean rebuild shim - no Firebase SSE connections
import { useState, useCallback } from 'react';

export interface RealTimeEvent {
  type: 'trade_created' | 'trade_updated' | 'trade_deleted' | 'import_progress' | 'analytics_updated' | 'notification' | 'connection' | 'heartbeat';
  data: unknown;
  timestamp: string;
}

export interface ImportProgress {
  uploadId: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalRows?: number;
  processedRows?: number;
  errors?: Array<{ row: number; error: string }>;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  data?: unknown;
  createdAt: string;
  read: boolean;
}

export interface RealTimeState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  clientId: string | null;
  events: RealTimeEvent[];
  notifications: Notification[];
  importProgress: Map<string, ImportProgress>;
  lastHeartbeat: string | null;
}

export interface RealTimeOptions {
  subscriptions?: string[];
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  maxEvents?: number;
}

export function useRealTime(_options: RealTimeOptions = {}) {
  const [state] = useState<RealTimeState>({
    connected: false,
    connecting: false,
    error: null,
    clientId: null,
    events: [],
    notifications: [],
    importProgress: new Map(),
    lastHeartbeat: null,
  });

  const connect = useCallback(async () => {
    console.log('useRealTime: Lean rebuild mode - no SSE connections');
  }, []);

  const disconnect = useCallback(() => {
    // No-op
  }, []);

  const getStatus = useCallback(async () => {
    return null;
  }, []);

  const clearEvents = useCallback(() => {
    // No-op
  }, []);

  const clearNotifications = useCallback(() => {
    // No-op
  }, []);

  const markNotificationAsRead = useCallback((_notificationId: string) => {
    // No-op
  }, []);

  const getImportProgress = useCallback((_uploadId: string): ImportProgress | undefined => {
    return undefined;
  }, []);

  return {
    connected: state.connected,
    connecting: state.connecting,
    error: state.error,
    clientId: state.clientId,
    events: state.events,
    notifications: state.notifications,
    unreadNotifications: [],
    lastHeartbeat: state.lastHeartbeat,
    connect,
    disconnect,
    getStatus,
    clearEvents,
    clearNotifications,
    markNotificationAsRead,
    getImportProgress,
    latestEvent: null,
    isHealthy: false,
  };
}
