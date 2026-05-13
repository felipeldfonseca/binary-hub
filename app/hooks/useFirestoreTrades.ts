// Lean rebuild shim - no Firestore real-time connections
import { useState, useEffect, useCallback } from 'react';
import { Trade } from './useTrades';

export interface FirestoreTradesOptions {
  limit?: number;
  orderByField?: keyof Trade;
  orderDirection?: 'asc' | 'desc';
  realTimeUpdates?: boolean;
  filters?: {
    result?: 'win' | 'loss' | 'tie';
    asset?: string;
    startDate?: Date;
    endDate?: Date;
  };
}

export interface FirestoreTradesState {
  trades: Trade[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  lastUpdate: Date | null;
  subscription: 'active' | 'inactive' | 'error';
}

export function useFirestoreTrades(_options: FirestoreTradesOptions = {}) {
  const [state, setState] = useState<FirestoreTradesState>({
    trades: [],
    loading: true,
    error: null,
    connected: false,
    lastUpdate: null,
    subscription: 'inactive',
  });

  useEffect(() => {
    // Simulate loading completion
    const timer = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        loading: false,
        connected: false,
        subscription: 'inactive',
      }));
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const reconnect = useCallback(() => {
    console.log('useFirestoreTrades: Lean rebuild mode - no Firestore connections');
  }, []);

  return {
    trades: state.trades,
    loading: state.loading,
    error: state.error,
    connected: state.connected,
    subscription: state.subscription,
    lastUpdate: state.lastUpdate,
    reconnect,
    isHealthy: false,
    isEmpty: true,
    hasError: false,
    isRetrying: false,
    retryCount: 0,
  };
}
