// Lean rebuild shim - no Firestore connections
import { useRef, useCallback, useEffect } from 'react';

type Unsubscribe = () => void;

/**
 * Lean rebuild shim - Firestore listener manager
 * No actual Firestore connections in lean rebuild
 */
export function useFirestoreManager() {
  const activeListenersRef = useRef<Map<string, Unsubscribe>>(new Map());
  const pendingListenersRef = useRef<Set<string>>(new Set());

  const registerListener = useCallback((key: string, unsubscribe: Unsubscribe) => {
    const existing = activeListenersRef.current.get(key);
    if (existing) {
      try {
        existing();
      } catch (error) {
        console.warn(`Error cleaning up listener ${key}:`, error);
      }
    }
    activeListenersRef.current.set(key, unsubscribe);
    pendingListenersRef.current.delete(key);
  }, []);

  const unregisterListener = useCallback((key: string) => {
    const unsubscribe = activeListenersRef.current.get(key);
    if (unsubscribe) {
      try {
        unsubscribe();
      } catch (error) {
        console.warn(`Error unregistering listener ${key}:`, error);
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
    activeListenersRef.current.forEach((unsubscribe, key) => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn(`Error cleaning up listener ${key}:`, error);
      }
    });
    activeListenersRef.current.clear();
    pendingListenersRef.current.clear();
  }, []);

  useEffect(() => {
    return cleanupAllListeners;
  }, [cleanupAllListeners]);

  return {
    registerListener,
    unregisterListener,
    isListenerPending,
    markListenerPending,
    getActiveListenerCount,
    cleanupAllListeners,
  };
}
