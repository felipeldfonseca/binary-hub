import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import { auth } from '../lib/firebase';

export interface RealTimeEvent {
  type: 'trade_created' | 'trade_updated' | 'trade_deleted' | 'import_progress' | 'analytics_updated' | 'notification' | 'connection' | 'heartbeat';
  data: any;
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
  data?: any;
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

export function useRealTime(options: RealTimeOptions = {}) {
  const { user } = useAuth();
  const {
    subscriptions = ['trades', 'analytics', 'imports', 'notifications'],
    autoReconnect = true,
    maxReconnectAttempts = 5,
    reconnectDelay = 3000,
    maxEvents = 100
  } = options;

  const [state, setState] = useState<RealTimeState>({
    connected: false,
    connecting: false,
    error: null,
    clientId: null,
    events: [],
    notifications: [],
    importProgress: new Map(),
    lastHeartbeat: null
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const API_BASE_URL = process.env.NODE_ENV === 'production'
    ? 'https://us-central1-binary-hub.cloudfunctions.net/api'
    : 'http://localhost:5001/binary-hub/us-central1/api';

  const addEvent = useCallback((event: RealTimeEvent) => {
    setState(prev => ({
      ...prev,
      events: [event, ...prev.events].slice(0, maxEvents)
    }));
  }, [maxEvents]);

  const connect = useCallback(async () => {
    if (!user || state.connected || state.connecting) return;

    setState(prev => ({ ...prev, connecting: true, error: null }));

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const url = `${API_BASE_URL}/v1/realtime/events`;
      
      const eventSource = new EventSource(url, {
        withCredentials: false,
      });

      // Override headers for authentication
      if (idToken) {
        const originalOpen = eventSource.addEventListener;
        eventSource.addEventListener = function(type: string, listener: any, options?: any) {
          if (type === 'open') {
            // Add authentication header somehow - EventSource doesn't support custom headers
            // We'll need to pass the token as a query parameter instead
          }
          return originalOpen.call(this, type, listener, options);
        };
      }

      eventSource.onopen = () => {
        console.log('SSE connection established');
        setState(prev => ({
          ...prev,
          connected: true,
          connecting: false,
          error: null
        }));
        reconnectAttemptsRef.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('SSE event received:', data);

          // Handle different event types
          switch (data.type) {
            case 'connection':
              setState(prev => ({
                ...prev,
                clientId: data.data.clientId
              }));
              // Update subscriptions after connection
              updateSubscriptions(data.data.clientId);
              break;

            case 'heartbeat':
              setState(prev => ({
                ...prev,
                lastHeartbeat: data.data.timestamp
              }));
              break;

            case 'import_progress':
              const progress = data.data as ImportProgress;
              setState(prev => ({
                ...prev,
                importProgress: new Map(prev.importProgress.set(progress.uploadId, progress))
              }));
              addEvent(data);
              break;

            case 'notification':
              const notification = data.data as Notification;
              setState(prev => ({
                ...prev,
                notifications: [notification, ...prev.notifications.slice(0, 49)] // Keep last 50 notifications
              }));
              addEvent(data);
              break;

            case 'trade_created':
            case 'trade_updated':
            case 'trade_deleted':
            case 'analytics_updated':
              addEvent(data);
              break;

            default:
              console.log('Unknown SSE event type:', data.type);
              addEvent(data);
          }
        } catch (error) {
          console.error('Error parsing SSE event:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        setState(prev => ({
          ...prev,
          connected: false,
          connecting: false,
          error: 'Connection error occurred'
        }));

        // Auto-reconnect logic
        if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`Attempting to reconnect... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay * reconnectAttemptsRef.current);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setState(prev => ({
            ...prev,
            error: `Failed to connect after ${maxReconnectAttempts} attempts`
          }));
        }
      };

      eventSourceRef.current = eventSource;

    } catch (error) {
      console.error('Failed to establish SSE connection:', error);
      setState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      }));
    }
  }, [user, state.connected, state.connecting, autoReconnect, maxReconnectAttempts, reconnectDelay, API_BASE_URL, addEvent]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setState(prev => ({
      ...prev,
      connected: false,
      connecting: false,
      clientId: null,
      error: null
    }));
  }, []);

  const updateSubscriptions = useCallback(async (clientId: string) => {
    if (!user || !clientId) return;

    try {
      const idToken = await auth.currentUser?.getIdToken();
      
      const response = await fetch(`${API_BASE_URL}/v1/realtime/subscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken || 'mock-token-for-testing'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          subscriptions
        })
      });

      if (!response.ok) {
        console.error('Failed to update subscriptions:', response.statusText);
      }
    } catch (error) {
      console.error('Error updating subscriptions:', error);
    }
  }, [user, subscriptions, API_BASE_URL]);

  const getStatus = useCallback(async () => {
    if (!user) return null;

    try {
      const idToken = await auth.currentUser?.getIdToken();
      
      const response = await fetch(`${API_BASE_URL}/v1/realtime/status`, {
        headers: {
          'Authorization': `Bearer ${idToken || 'mock-token-for-testing'}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error getting real-time status:', error);
    }
    return null;
  }, [user, API_BASE_URL]);

  const clearEvents = useCallback(() => {
    setState(prev => ({
      ...prev,
      events: []
    }));
  }, []);

  const clearNotifications = useCallback(() => {
    setState(prev => ({
      ...prev,
      notifications: []
    }));
  }, []);

  const markNotificationAsRead = useCallback((notificationId: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(notification =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )
    }));
  }, []);

  const getImportProgress = useCallback((uploadId: string): ImportProgress | undefined => {
    return state.importProgress.get(uploadId);
  }, [state.importProgress]);

  // Auto-connect when user is available
  useEffect(() => {
    if (user && !state.connected && !state.connecting) {
      connect();
    } else if (!user && (state.connected || state.connecting)) {
      disconnect();
    }
  }, [user, connect, disconnect, state.connected, state.connecting]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    // State
    connected: state.connected,
    connecting: state.connecting,
    error: state.error,
    clientId: state.clientId,
    events: state.events,
    notifications: state.notifications,
    unreadNotifications: state.notifications.filter(n => !n.read),
    lastHeartbeat: state.lastHeartbeat,

    // Actions
    connect,
    disconnect,
    getStatus,
    clearEvents,
    clearNotifications,
    markNotificationAsRead,
    getImportProgress,

    // Convenience getters
    latestEvent: state.events[0] || null,
    isHealthy: state.connected && (
      !state.lastHeartbeat || 
      (Date.now() - new Date(state.lastHeartbeat).getTime()) < 60000 // Last heartbeat within 1 minute
    ),
  };
}