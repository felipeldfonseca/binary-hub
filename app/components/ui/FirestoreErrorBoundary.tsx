'use client'

import React, { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class FirestoreErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is a Firestore internal assertion error
    const isFirestoreError = error.message?.includes('FIRESTORE') && 
                            (error.message?.includes('INTERNAL ASSERTION FAILED') || 
                             error.message?.includes('Unexpected state'))
    
    if (isFirestoreError) {
      console.warn('Firestore internal error caught by boundary:', error)
      return { hasError: true, error }
    }
    
    // For other errors, let them bubble up
    throw error
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('FirestoreErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="card bg-yellow-900/20 border-yellow-400/30 text-center p-6">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="font-heading text-xl font-bold text-yellow-300 mb-2">
            Firestore Connection Issue
          </h3>
          <p className="text-gray-300 mb-4">
            We're experiencing a temporary connection issue with the database. 
            Please refresh the page to continue.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded transition-colors"
          >
            Refresh Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}