'use client'
import React, { useState, useEffect } from 'react'
import { useNotifications } from '@/hooks/useNotifications'
import { useLanguage } from '@/lib/contexts/LanguageContext'

interface LiveNotificationsProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  maxVisible?: number
  autoHideDuration?: number
}

export default function LiveNotifications({
  position = 'top-right',
  maxVisible = 3,
  autoHideDuration = 5000
}: LiveNotificationsProps) {
  const { isPortuguese } = useLanguage()
  const { 
    notifications, 
    markAsRead, 
    dismiss,
    hasUnread,
    unreadCount
  } = useNotifications()

  const [visibleNotifications, setVisibleNotifications] = useState<string[]>([])
  const [isMinimized, setIsMinimized] = useState(false)

  // Get only recent unread notifications for toast display
  const toastNotifications = notifications
    .filter(n => !n.read)
    .filter(n => {
      // Only show notifications from last 30 seconds
      const notificationAge = Date.now() - new Date(n.createdAt).getTime()
      return notificationAge < 30000
    })
    .slice(0, maxVisible)

  // Auto-hide success notifications
  useEffect(() => {
    toastNotifications.forEach(notification => {
      if (notification.type === 'success' && !visibleNotifications.includes(notification.id)) {
        setVisibleNotifications(prev => [...prev, notification.id])
        
        // Auto-hide after duration
        setTimeout(() => {
          markAsRead(notification.id)
          setVisibleNotifications(prev => prev.filter(id => id !== notification.id))
        }, autoHideDuration)
      }
    })
  }, [toastNotifications, visibleNotifications, markAsRead, autoHideDuration])

  // Position classes
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  }[position]

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return '✅'
      case 'error': return '❌'
      case 'warning': return '⚠️'
      case 'info': return 'ℹ️'
      default: return '📢'
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success': return 'border-green-400 bg-green-900/20 text-green-100'
      case 'error': return 'border-red-400 bg-red-900/20 text-red-100'
      case 'warning': return 'border-yellow-400 bg-yellow-900/20 text-yellow-100'
      case 'info': return 'border-blue-400 bg-blue-900/20 text-blue-100'
      default: return 'border-gray-400 bg-gray-900/20 text-gray-100'
    }
  }

  if (isMinimized) {
    return (
      <div className={`fixed ${positionClasses} z-50`}>
        <button
          onClick={() => setIsMinimized(false)}
          className={`
            relative p-3 rounded-full border backdrop-blur-sm transition-all duration-200 hover:scale-110
            ${hasUnread ? 'border-orange-400 bg-orange-900/20' : 'border-gray-400 bg-gray-900/20'}
          `}
        >
          <span className="text-lg">🔔</span>
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </div>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className={`fixed ${positionClasses} z-50 space-y-2 max-w-md`}>
      {/* Minimize button */}
      <div className="flex justify-end">
        <button
          onClick={() => setIsMinimized(true)}
          className="p-1 text-gray-400 hover:text-white transition-colors"
          title={isPortuguese ? 'Minimizar notificações' : 'Minimize notifications'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
      </div>

      {/* Toast notifications */}
      {toastNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`
            relative p-4 rounded-lg border backdrop-blur-sm shadow-lg transition-all duration-300 transform
            ${getNotificationColor(notification.type)}
            animate-in slide-in-from-right-full
          `}
          style={{
            animation: 'slideInRight 0.3s ease-out'
          }}
        >
          <div className="flex items-start gap-3">
            <span className="text-lg flex-shrink-0">
              {getNotificationIcon(notification.type)}
            </span>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm mb-1">
                {notification.title}
              </h4>
              <p className="text-sm opacity-90 leading-relaxed">
                {notification.message}
              </p>
              
              {/* Additional data display */}
              {notification.data && (
                <div className="mt-2 text-xs opacity-75">
                  {notification.data.importedRows && (
                    <div>
                      {isPortuguese ? 'Trades importados:' : 'Trades imported:'} {notification.data.importedRows}
                    </div>
                  )}
                  {notification.data.duplicateRows && notification.data.duplicateRows > 0 && (
                    <div>
                      {isPortuguese ? 'Duplicadas ignoradas:' : 'Duplicates skipped:'} {notification.data.duplicateRows}
                    </div>
                  )}
                  {notification.data.processingTime && (
                    <div>
                      {isPortuguese ? 'Tempo de processamento:' : 'Processing time:'} {Math.round(notification.data.processingTime)}ms
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs opacity-60">
                  {new Date(notification.createdAt).toLocaleTimeString()}
                </span>
                
                <div className="flex gap-2">
                  {!notification.read && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      className="text-xs opacity-75 hover:opacity-100 transition-opacity"
                    >
                      {isPortuguese ? 'Marcar como lida' : 'Mark as read'}
                    </button>
                  )}
                  
                  <button
                    onClick={() => dismiss(notification.id)}
                    className="text-xs opacity-75 hover:opacity-100 transition-opacity"
                  >
                    {isPortuguese ? 'Dispensar' : 'Dismiss'}
                  </button>
                </div>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => dismiss(notification.id)}
              className="text-current opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Auto-hide progress bar for success notifications */}
          {notification.type === 'success' && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-current opacity-20 rounded-b-lg overflow-hidden">
              <div 
                className="h-full bg-current opacity-60 animate-shrink-width"
                style={{
                  animation: `shrinkWidth ${autoHideDuration}ms linear`
                }}
              />
            </div>
          )}
        </div>
      ))}

      {/* All notifications panel (when expanded) */}
      {notifications.length > maxVisible && (
        <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg border border-gray-600 p-3">
          <div className="text-center text-sm text-gray-300">
            {isPortuguese ? 
              `${notifications.length - maxVisible} notificações adicionais` :
              `${notifications.length - maxVisible} more notifications`
            }
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes shrinkWidth {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        
        .animate-shrink-width {
          animation: shrinkWidth linear;
        }
      `}</style>
    </div>
  )
}