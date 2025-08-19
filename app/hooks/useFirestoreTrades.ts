import { useState, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { useFirestoreManager } from './useFirestoreManager';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  where, 
  onSnapshot, 
  Unsubscribe,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
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

export function useFirestoreTrades(options: FirestoreTradesOptions = {}) {
  const { user } = useAuth();
  const firestoreManager = useFirestoreManager();
  const {
    limit: queryLimit = 100,
    orderByField = 'entryTime',
    orderDirection = 'desc',
    realTimeUpdates = true,
    filters = {}
  } = options;

  const [state, setState] = useState<FirestoreTradesState>({
    trades: [],
    loading: false,
    error: null,
    connected: false,
    lastUpdate: null,
    subscription: 'inactive'
  });

  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCount = useRef(0);
  const maxRetries = 3; // Reduced retry attempts to prevent cascade failures
  const listenerKey = useRef<string>(`firestore-trades-${user?.uid || 'anonymous'}-${Date.now()}`).current;

  useEffect(() => {
    if (!user || !realTimeUpdates) {
      return;
    }

    const setupRealtimeListener = () => {
      // Prevent multiple simultaneous setup attempts
      if (firestoreManager.isListenerPending(listenerKey)) {
        console.log('Firestore listener setup already pending, skipping...');
        return;
      }

      firestoreManager.markListenerPending(listenerKey);

      try {
        // Clean up any existing listener first
        firestoreManager.unregisterListener(listenerKey);
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }

        setState(prev => ({ 
          ...prev, 
          loading: true, 
          error: null, 
          subscription: 'active' 
        }));

        // Build the query with proper constraint order
        const tradesRef = collection(db, 'trades', user.uid, 'trades');
        
        // Collect all query constraints
        const constraints: any[] = [];

        // Add filters first (where clauses)
        if (filters.result) {
          constraints.push(where('result', '==', filters.result));
        }

        if (filters.asset) {
          constraints.push(where('asset', '==', filters.asset));
        }

        if (filters.startDate) {
          const startTimestamp = Timestamp.fromDate(filters.startDate);
          constraints.push(where('entryTime', '>=', startTimestamp));
        }

        if (filters.endDate) {
          const endTimestamp = Timestamp.fromDate(filters.endDate);
          constraints.push(where('entryTime', '<=', endTimestamp));
        }

        // Add ordering after where clauses
        constraints.push(orderBy(orderByField, orderDirection));

        // Add limit last
        constraints.push(limit(queryLimit));

        // Build query with all constraints at once
        const q = query(tradesRef, ...constraints);

        // Set up the real-time listener with enhanced error handling
        const unsubscribe = onSnapshot(
          q,
          {
            includeMetadataChanges: false // Disable metadata changes to reduce complexity
          },
          (snapshot) => {
            console.log('Firestore trades snapshot received');
            
            const trades: Trade[] = [];
            
            snapshot.forEach((doc) => {
              try {
                const data = doc.data();
                
                // Safely convert timestamps
                const convertTimestamp = (timestamp: any) => {
                  if (!timestamp) return new Date();
                  if (timestamp.toDate) return timestamp.toDate();
                  if (typeof timestamp === 'string') return new Date(timestamp);
                  if (timestamp instanceof Date) return timestamp;
                  return new Date();
                };
                
                // Convert Firestore data to Trade interface with safe defaults
                const trade: Trade = {
                  id: doc.id,
                  userId: data.userId || user.uid,
                  tradeId: data.tradeId || doc.id,
                  asset: data.asset || '',
                  direction: data.direction || 'call',
                  amount: Number(data.amount) || 0,
                  entryPrice: Number(data.entryPrice) || 0,
                  exitPrice: Number(data.exitPrice) || 0,
                  entryTime: convertTimestamp(data.entryTime),
                  exitTime: convertTimestamp(data.exitTime),
                  timeframe: data.timeframe || '5m',
                  candleTime: data.candleTime || '',
                  refunded: Number(data.refunded) || 0,
                  executed: Number(data.executed) || 0,
                  status: data.status || 'open',
                  result: data.result || 'pending',
                  profit: Number(data.profit) || 0,
                  payout: Number(data.payout) || 0,
                  platform: data.platform || '',
                  strategy: data.strategy || '',
                  notes: data.notes || '',
                  screenshots: data.screenshots || [],
                  createdAt: convertTimestamp(data.createdAt),
                  updatedAt: convertTimestamp(data.updatedAt),
                  importedAt: data.importedAt ? convertTimestamp(data.importedAt) : undefined,
                  importBatch: data.importBatch
                };
                
                trades.push(trade);
              } catch (error) {
                console.warn('Error processing trade document:', doc.id, error);
                // Skip malformed documents instead of breaking the entire process
              }
            });

            // Check if this is from cache (offline mode)
            const isFromCache = snapshot.metadata.fromCache;
            const hasPendingWrites = snapshot.metadata.hasPendingWrites;

            setState(prev => ({
              ...prev,
              trades,
              loading: false,
              error: null,
              connected: !isFromCache,
              lastUpdate: new Date(),
              subscription: 'active'
            }));

            // Reset retry count on successful update
            retryCount.current = 0;

            console.log(`Firestore trades updated: ${trades.length} trades, fromCache: ${isFromCache}, hasPendingWrites: ${hasPendingWrites}`);
          },
          (error) => {
            console.error('Firestore trades listener error:', error);
            
            // Unregister the failed listener
            firestoreManager.unregisterListener(listenerKey);
            
            setState(prev => ({
              ...prev,
              loading: false,
              error: error.message,
              connected: false,
              subscription: 'error'
            }));

            // Check for internal assertion failures and circuit break
            const isInternalError = error.message?.includes('INTERNAL ASSERTION FAILED') || 
                                  error.message?.includes('Unexpected state');
            
            if (isInternalError) {
              console.warn('Firestore internal error detected, implementing circuit breaker');
              retryCount.current = maxRetries; // Prevent retries for internal errors
              setState(prev => ({
                ...prev,
                error: 'Firestore internal error - please refresh the page'
              }));
              return;
            }

            // Implement exponential backoff retry for other errors
            if (retryCount.current < maxRetries) {
              retryCount.current++;
              const retryDelay = Math.min(2000 * Math.pow(2, retryCount.current - 1), 15000);
              
              console.log(`Retrying Firestore connection in ${retryDelay}ms (attempt ${retryCount.current}/${maxRetries})`);
              
              retryTimeoutRef.current = setTimeout(() => {
                setupRealtimeListener();
              }, retryDelay);
            } else {
              console.error('Max Firestore retry attempts reached');
              setState(prev => ({
                ...prev,
                error: 'Connection failed after multiple attempts - please refresh the page'
              }));
            }
          }
        );

        unsubscribeRef.current = unsubscribe;
        
        // Register with the Firestore manager
        firestoreManager.registerListener(listenerKey, unsubscribe);

      } catch (error) {
        console.error('Error setting up Firestore listener:', error);
        setState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to setup real-time listener',
          subscription: 'error'
        }));
      }
    };

    setupRealtimeListener();

    // Cleanup function
    return () => {
      // Unregister from Firestore manager first
      firestoreManager.unregisterListener(listenerKey);
      
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      
      setState(prev => ({
        ...prev,
        subscription: 'inactive'
      }));
    };
  }, [
    user, 
    realTimeUpdates, 
    queryLimit, 
    orderByField, 
    orderDirection,
    filters.result,
    filters.asset,
    filters.startDate,
    filters.endDate
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const reconnect = () => {
    retryCount.current = 0;
    
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Re-trigger the effect by updating a state value
    setState(prev => ({
      ...prev,
      subscription: 'inactive'
    }));
  };

  return {
    // Data
    trades: state.trades,
    loading: state.loading,
    error: state.error,

    // Connection state
    connected: state.connected,
    subscription: state.subscription,
    lastUpdate: state.lastUpdate,

    // Actions
    reconnect,

    // Computed properties
    isHealthy: state.connected && state.subscription === 'active',
    isEmpty: state.trades.length === 0 && !state.loading,
    hasError: !!state.error,
    isRetrying: state.subscription === 'error' && retryCount.current > 0,
    retryCount: retryCount.current,
  };
}