import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRealTime } from './useRealTime';
import { useTrades, Trade } from './useTrades';
import { useTradeStats } from './useTradeStats';

export interface RealTimeTradesState {
  trades: Trade[];
  loading: boolean;
  error: string | null;
  lastUpdate: string | null;
  pendingUpdates: number;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
}

export interface TradeUpdate {
  type: 'created' | 'updated' | 'deleted';
  trade: Trade;
  timestamp: string;
}

export function useRealTimeTrades() {
  const { events, connected } = useRealTime({
    subscriptions: ['trades', 'analytics']
  });
  
  const { 
    trades: baseTrades, 
    loading: baseLoading, 
    error: baseError, 
    fetchTrades 
  } = useTrades();
  
  const { refetch: refetchStats } = useTradeStats();

  const [state, setState] = useState<RealTimeTradesState>({
    trades: [],
    loading: false,
    error: null,
    lastUpdate: null,
    pendingUpdates: 0,
    syncStatus: 'idle'
  });

  // Track recent updates to prevent duplicate processing
  const [processedEvents, setProcessedEvents] = useState<Set<string>>(new Set());

  // Merge base trades with real-time updates
  const mergedTrades = useMemo(() => {
    return baseTrades;
  }, [baseTrades]);

  // Process real-time trade events
  useEffect(() => {
    const tradeEvents = events.filter(event => 
      ['trade_created', 'trade_updated', 'trade_deleted'].includes(event.type) &&
      !processedEvents.has(event.timestamp)
    );

    if (tradeEvents.length === 0) return;

    let needsRefresh = false;

    tradeEvents.forEach(event => {
      const eventKey = event.timestamp;
      
      if (processedEvents.has(eventKey)) return;

      console.log('Processing real-time trade event:', event);

      switch (event.type) {
        case 'trade_created':
          needsRefresh = true;
          setState(prev => ({
            ...prev,
            lastUpdate: event.timestamp,
            syncStatus: 'syncing'
          }));
          break;

        case 'trade_updated':
          needsRefresh = true;
          setState(prev => ({
            ...prev,
            lastUpdate: event.timestamp,
            syncStatus: 'syncing'
          }));
          break;

        case 'trade_deleted':
          needsRefresh = true;
          setState(prev => ({
            ...prev,
            lastUpdate: event.timestamp,
            syncStatus: 'syncing'
          }));
          break;
      }

      // Mark event as processed
      setProcessedEvents(prev => new Set([...prev, eventKey]));
    });

    // Refresh data if needed
    if (needsRefresh) {
      const refreshTimer = setTimeout(async () => {
        try {
          await fetchTrades();
          await refetchStats();
          setState(prev => ({
            ...prev,
            syncStatus: 'synced',
            pendingUpdates: 0
          }));
          
          // Reset sync status after 2 seconds
          setTimeout(() => {
            setState(prev => ({
              ...prev,
              syncStatus: 'idle'
            }));
          }, 2000);
        } catch (error) {
          console.error('Error refreshing trades after real-time update:', error);
          setState(prev => ({
            ...prev,
            syncStatus: 'error',
            error: error instanceof Error ? error.message : 'Sync failed'
          }));
        }
      }, 500); // Small delay to batch multiple events

      return () => clearTimeout(refreshTimer);
    }
  }, [events, processedEvents, fetchTrades, refetchStats]);

  // Update state when base trades change
  useEffect(() => {
    setState(prev => ({
      ...prev,
      trades: mergedTrades,
      loading: baseLoading,
      error: baseError
    }));
  }, [mergedTrades, baseLoading, baseError]);

  // Clean up old processed events (keep last 100)
  useEffect(() => {
    setProcessedEvents(prev => {
      const eventArray = Array.from(prev);
      if (eventArray.length > 100) {
        return new Set(eventArray.slice(-50)); // Keep last 50
      }
      return prev;
    });
  }, [events]);

  const forceSync = useCallback(async () => {
    setState(prev => ({
      ...prev,
      syncStatus: 'syncing'
    }));

    try {
      await fetchTrades();
      await refetchStats();
      setState(prev => ({
        ...prev,
        syncStatus: 'synced',
        lastUpdate: new Date().toISOString()
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        syncStatus: 'error',
        error: error instanceof Error ? error.message : 'Sync failed'
      }));
    }
  }, [fetchTrades, refetchStats]);

  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
      syncStatus: 'idle'
    }));
  }, []);

  // Auto-sync when connection is restored
  useEffect(() => {
    if (connected && state.syncStatus === 'error') {
      forceSync();
    }
  }, [connected, state.syncStatus, forceSync]);

  return {
    // Data
    trades: state.trades,
    loading: state.loading,
    error: state.error,

    // Real-time state
    connected,
    syncStatus: state.syncStatus,
    lastUpdate: state.lastUpdate,
    pendingUpdates: state.pendingUpdates,

    // Actions
    forceSync,
    clearError,

    // Computed properties
    isStale: state.lastUpdate && (Date.now() - new Date(state.lastUpdate).getTime()) > 300000, // 5 minutes
    hasRecentUpdate: state.lastUpdate && (Date.now() - new Date(state.lastUpdate).getTime()) < 10000, // 10 seconds
  };
}