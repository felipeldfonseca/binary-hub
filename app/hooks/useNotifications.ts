import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRealTime, Notification } from './useRealTime';

export interface NotificationFilters {
  type?: 'success' | 'error' | 'info' | 'warning';
  read?: boolean;
  limit?: number;
}

export interface NotificationGroup {
  type: 'success' | 'error' | 'info' | 'warning';
  count: number;
  notifications: Notification[];
  hasUnread: boolean;
}

export function useNotifications() {
  const { 
    notifications, 
    unreadNotifications, 
    connected,
    markNotificationAsRead,
    clearNotifications
  } = useRealTime({
    subscriptions: ['notifications']
  });

  // Alias the functions for clarity
  const markAsReadInRealTime = markNotificationAsRead;
  const clearInRealTime = clearNotifications;

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Filter out dismissed notifications
  const visibleNotifications = useMemo(() => {
    return notifications.filter(notification => !dismissed.has(notification.id));
  }, [notifications, dismissed]);

  const visibleUnreadNotifications = useMemo(() => {
    return unreadNotifications.filter(notification => !dismissed.has(notification.id));
  }, [unreadNotifications, dismissed]);

  // Get filtered notifications
  const getNotifications = useCallback((filters: NotificationFilters = {}): Notification[] => {
    let filtered = visibleNotifications;

    if (filters.type) {
      filtered = filtered.filter(n => n.type === filters.type);
    }

    if (filters.read !== undefined) {
      filtered = filtered.filter(n => n.read === filters.read);
    }

    if (filters.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [visibleNotifications]);

  // Group notifications by type
  const groupedNotifications = useMemo((): NotificationGroup[] => {
    const groups = visibleNotifications.reduce((acc, notification) => {
      if (!acc[notification.type]) {
        acc[notification.type] = [];
      }
      acc[notification.type].push(notification);
      return acc;
    }, {} as Record<string, Notification[]>);

    return Object.entries(groups).map(([type, notifications]) => ({
      type: type as 'success' | 'error' | 'info' | 'warning',
      count: notifications.length,
      notifications: notifications.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
      hasUnread: notifications.some(n => !n.read)
    }));
  }, [visibleNotifications]);

  // Mark notification as read
  const markAsRead = useCallback((notificationId: string) => {
    markAsReadInRealTime(notificationId);
  }, [markAsReadInRealTime]);

  // Mark multiple notifications as read
  const markMultipleAsRead = useCallback((notificationIds: string[]) => {
    notificationIds.forEach(id => markAsReadInRealTime(id));
  }, [markAsReadInRealTime]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    visibleUnreadNotifications.forEach(notification => {
      markAsReadInRealTime(notification.id);
    });
  }, [visibleUnreadNotifications, markAsReadInRealTime]);

  // Dismiss notification (hide from UI)
  const dismiss = useCallback((notificationId: string) => {
    setDismissed(prev => new Set([...Array.from(prev), notificationId]));
  }, []);

  // Dismiss multiple notifications
  const dismissMultiple = useCallback((notificationIds: string[]) => {
    setDismissed(prev => new Set([...Array.from(prev), ...notificationIds]));
  }, []);

  // Clear all dismissed notifications
  const clearDismissed = useCallback(() => {
    setDismissed(new Set());
  }, []);

  // Clear all notifications (both dismissed and from real-time)
  const clearAll = useCallback(() => {
    clearInRealTime();
    setDismissed(new Set());
  }, [clearInRealTime]);

  // Get recent notifications (last 24 hours)
  const recentNotifications = useMemo(() => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return visibleNotifications.filter(notification => 
      new Date(notification.createdAt) > yesterday
    );
  }, [visibleNotifications]);

  // Get critical notifications (errors and warnings)
  const criticalNotifications = useMemo(() => {
    return visibleNotifications.filter(notification => 
      notification.type === 'error' || notification.type === 'warning'
    );
  }, [visibleNotifications]);

  // Statistics
  const stats = useMemo(() => {
    const total = visibleNotifications.length;
    const unread = visibleUnreadNotifications.length;
    const byType = visibleNotifications.reduce((acc, notification) => {
      acc[notification.type] = (acc[notification.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      unread,
      read: total - unread,
      byType,
      hasUnread: unread > 0,
      hasCritical: (byType.error || 0) + (byType.warning || 0) > 0
    };
  }, [visibleNotifications, visibleUnreadNotifications]);

  // Auto-dismiss success notifications after 5 seconds
  useEffect(() => {
    const successNotifications = visibleNotifications.filter(
      n => n.type === 'success' && !n.read && !dismissed.has(n.id)
    );

    if (successNotifications.length === 0) return;

    const timers = successNotifications.map(notification => 
      setTimeout(() => {
        markAsRead(notification.id);
      }, 5000)
    );

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [visibleNotifications, dismissed, markAsRead]);

  // Play sound for critical notifications (if browser supports it)
  useEffect(() => {
    const criticalNotifications = visibleUnreadNotifications.filter(
      n => n.type === 'error' || n.type === 'warning'
    );

    if (criticalNotifications.length > 0) {
      // Only play sound for the most recent critical notification
      const mostRecent = criticalNotifications[0];
      const isVeryRecent = Date.now() - new Date(mostRecent.createdAt).getTime() < 2000;
      
      if (isVeryRecent) {
        try {
          // Try to play a notification sound
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjOR1fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjOR1fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjOR1fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjOR1fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjOR1fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjOR1fLNeSsFJHfH8N2QQAoUXrTp66hVFA==');
          audio.volume = 0.3;
          audio.play().catch(() => {
            // Ignore audio play errors (browser restrictions)
          });
        } catch (error) {
          // Ignore audio creation errors
        }
      }
    }
  }, [visibleUnreadNotifications]);

  return {
    // Core data
    notifications: visibleNotifications,
    unreadNotifications: visibleUnreadNotifications,
    groupedNotifications,
    
    // Filtered views
    recentNotifications,
    criticalNotifications,
    
    // Statistics
    stats,
    
    // Connection state
    connected,
    
    // Methods
    getNotifications,
    markAsRead,
    markMultipleAsRead,
    markAllAsRead,
    dismiss,
    dismissMultiple,
    clearDismissed,
    clearAll,
    
    // Helper properties
    hasNotifications: visibleNotifications.length > 0,
    hasUnread: visibleUnreadNotifications.length > 0,
    hasRecent: recentNotifications.length > 0,
    hasCritical: criticalNotifications.length > 0,
    unreadCount: visibleUnreadNotifications.length,
  };
}