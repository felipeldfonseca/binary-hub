import { useRef, useCallback, useEffect } from 'react';
import { Unsubscribe } from 'firebase/firestore';

/**
 * Centralized Firestore listener manager to prevent conflicts
 * and internal assertion errors from multiple simultaneous listeners
 */
export function useFirestoreManager() {
  const activeListenersRef = useRef<Map<string, Unsubscribe>>(new Map());
  const pendingListenersRef = useRef<Set<string>>(new Set());

  const registerListener = useCallback((key: string, unsubscribe: Unsubscribe) => {
    // Clean up any existing listener with the same key
    const existingUnsubscribe = activeListenersRef.current.get(key);
    if (existingUnsubscribe) {
      try {
        existingUnsubscribe();
      } catch (error) {
        console.warn(`Error cleaning up existing Firestore listener ${key}:`, error);
      }
    }

    // Register the new listener
    activeListenersRef.current.set(key, unsubscribe);
    pendingListenersRef.current.delete(key);
  }, []);

  const unregisterListener = useCallback((key: string) => {
    const unsubscribe = activeListenersRef.current.get(key);
    if (unsubscribe) {
      try {
        unsubscribe();
      } catch (error) {
        console.warn(`Error unregistering Firestore listener ${key}:`, error);
      }
      activeListenersRef.current.delete(key);
    }
    pendingListenersRef.current.delete(key);
  }, []);

  const isListenerPending = useCallback((key: string) => {
    return pendingListenersRef.current.has(key);
  }, []);

  const markListenerPending = useCallback((key: string) => {
    pendingListenersRef.current.add(key);
  }, []);

  const getActiveListenerCount = useCallback(() => {
    return activeListenersRef.current.size;
  }, []);

  const cleanupAllListeners = useCallback(() => {
    // Clean up all active listeners
    activeListenersRef.current.forEach((unsubscribe, key) => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn(`Error cleaning up Firestore listener ${key}:`, error);
      }
    });
    
    activeListenersRef.current.clear();
    pendingListenersRef.current.clear();
  }, []);

  // Clean up all listeners on unmount
  useEffect(() => {
    return cleanupAllListeners;
  }, [cleanupAllListeners]);

  return {
    registerListener,
    unregisterListener,
    isListenerPending,
    markListenerPending,
    getActiveListenerCount,
    cleanupAllListeners
  };
}