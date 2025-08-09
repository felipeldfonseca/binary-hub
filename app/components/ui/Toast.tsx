'use client'

import React, { createContext, useContext, useCallback, useState, ReactNode } from 'react'
import { XIcon, CheckIcon } from '../icons/XIcon'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
  dismissible?: boolean
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastContextType {
  toasts: Toast[]
  showToast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  clearToasts: () => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: ReactNode
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast: Toast = {
      id,
      duration: 5000,
      dismissible: true,
      ...toast
    }

    setToasts(prev => [...prev, newToast])

    // Auto dismiss after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        dismissToast(id)
      }, newToast.duration)
    }
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const clearToasts = useCallback(() => {
    setToasts([])
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, clearToasts }}>
      {children}
      <ToastContainer toasts={toasts} dismissToast={dismissToast} />
    </ToastContext.Provider>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  dismissToast: (id: string) => void
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, dismissToast }) => {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <ToastComponent key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  )
}

interface ToastComponentProps {
  toast: Toast
  onDismiss: (id: string) => void
}

const ToastComponent: React.FC<ToastComponentProps> = ({ toast, onDismiss }) => {
  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800'
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800'
    }
  }

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckIcon className="h-5 w-5 text-green-400" />
      case 'error':
        return <XIcon className="h-5 w-5 text-red-400" />
      case 'warning':
        return <span className="text-yellow-400 text-lg">⚠️</span>
      case 'info':
        return <span className="text-blue-400 text-lg">ℹ️</span>
      default:
        return null
    }
  }

  return (
    <div
      className={`
        max-w-sm w-full shadow-lg rounded-lg border p-4
        transform transition-all duration-300 ease-in-out
        ${getToastStyles(toast.type)}
      `}
      role="alert"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 mr-3 mt-0.5">
          {getIcon(toast.type)}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium">{toast.title}</h4>
          {toast.message && (
            <p className="text-sm opacity-90 mt-1">{toast.message}</p>
          )}
          
          {toast.action && (
            <div className="mt-3">
              <button
                onClick={toast.action.onClick}
                className="text-sm font-medium underline hover:no-underline focus:outline-none"
              >
                {toast.action.label}
              </button>
            </div>
          )}
        </div>

        {toast.dismissible && (
          <button
            onClick={() => onDismiss(toast.id)}
            className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 focus:outline-none"
            aria-label="Dismiss"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// Convenience functions
export const useToastHelpers = () => {
  const { showToast } = useToast()

  return {
    showSuccess: (title: string, message?: string, options?: Partial<Toast>) =>
      showToast({ type: 'success', title, message, ...options }),
    
    showError: (title: string, message?: string, options?: Partial<Toast>) =>
      showToast({ type: 'error', title, message, duration: 8000, ...options }),
    
    showWarning: (title: string, message?: string, options?: Partial<Toast>) =>
      showToast({ type: 'warning', title, message, ...options }),
    
    showInfo: (title: string, message?: string, options?: Partial<Toast>) =>
      showToast({ type: 'info', title, message, ...options })
  }
}