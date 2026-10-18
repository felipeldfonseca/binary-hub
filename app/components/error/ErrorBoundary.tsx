'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { logger } from '@/lib/utils/logger'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  resetOnPropsChange?: boolean
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId?: NodeJS.Timeout

  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Update state with error details
    this.setState({
      error,
      errorInfo
    })

    // Log error details
    logger.error('ErrorBoundary caught an error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    })

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)

    // Auto-reset after 10 seconds if not in development
    if (process.env.NODE_ENV !== 'development') {
      this.resetTimeoutId = setTimeout(() => {
        this.handleReset()
      }, 10000)
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetOnPropsChange, children } = this.props
    const { hasError } = this.state

    // Reset error state when props change if resetOnPropsChange is true
    if (hasError && resetOnPropsChange && prevProps.children !== children) {
      this.handleReset()
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }
  }

  handleReset = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
      this.resetTimeoutId = undefined
    }

    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-md mx-auto text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-6">
              We're sorry, but something unexpected happened. Please try again.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left bg-gray-100 p-4 rounded-lg mb-6">
                <summary className="cursor-pointer font-medium mb-2">
                  Error Details
                </summary>
                <pre className="text-sm text-red-600 whitespace-pre-wrap">
                  {this.state.error.message}
                  {this.state.error.stack && (
                    <>
                      {'\n\nStack Trace:\n'}
                      {this.state.error.stack}
                    </>
                  )}
                </pre>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

// Specialized error boundaries for specific use cases
export const ChartErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={
      <div className="h-64 flex items-center justify-center border border-gray-200 rounded-lg">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">📊</div>
          <p>Unable to load chart</p>
          <p className="text-sm">Please try refreshing the page</p>
        </div>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
)

export const DataTableErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={
      <div className="p-8 text-center border border-gray-200 rounded-lg">
        <div className="text-4xl mb-2">📋</div>
        <p className="text-gray-500">Unable to load data table</p>
        <p className="text-sm text-gray-400">Please try refreshing the page</p>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
)

export const FormErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center text-red-600 mb-2">
          <span className="text-xl mr-2">⚠️</span>
          <h3 className="font-medium">Form Error</h3>
        </div>
        <p className="text-red-700 text-sm">
          There was an error loading this form. Please refresh the page and try again.
        </p>
      </div>
    }
    resetOnPropsChange={true}
  >
    {children}
  </ErrorBoundary>
)

export default ErrorBoundary