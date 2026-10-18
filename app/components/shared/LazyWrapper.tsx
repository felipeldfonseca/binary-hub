'use client'
import React, { Suspense, memo } from 'react'

interface LazyWrapperProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  threshold?: number
  rootMargin?: string
  className?: string
  onLoad?: () => void
}

/**
 * Lazy loading wrapper component that only renders children when in viewport
 */
const LazyWrapper = memo<LazyWrapperProps>(({
  children,
  fallback = <div className="animate-pulse bg-gray-700 rounded h-32" />,
  threshold = 0.1,
  rootMargin = '50px',
  className = '',
  onLoad
}) => {
  const ref = React.useRef<HTMLDivElement>(null)
  const [isIntersecting, setIsIntersecting] = React.useState(false)

  React.useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        setIsIntersecting(entry.isIntersecting)
      },
      { threshold, rootMargin }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [threshold, rootMargin])

  React.useEffect(() => {
    if (isIntersecting && onLoad) {
      onLoad()
    }
  }, [isIntersecting, onLoad])

  return (
    <div ref={ref} className={className}>
      {isIntersecting ? (
        <Suspense fallback={fallback}>
          {children}
        </Suspense>
      ) : (
        fallback
      )}
    </div>
  )
})

LazyWrapper.displayName = 'LazyWrapper'

export default LazyWrapper

/**
 * HOC for creating lazy-loaded components
 */
export function withLazyLoading<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    fallback?: React.ReactNode
    threshold?: number
    rootMargin?: string
  }
) {
  const WrappedComponent = memo((props: P) => (
    <LazyWrapper {...options}>
      <Component {...props} />
    </LazyWrapper>
  ))
  
  WrappedComponent.displayName = `withLazyLoading(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

/**
 * Pre-built lazy loading skeletons for common components
 */
export const LoadingSkeletons = {
  Dashboard: () => (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-gray-700 rounded-lg h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-700 rounded-lg h-80" />
        <div className="bg-gray-700 rounded-lg h-80" />
      </div>
    </div>
  ),

  TradesList: () => (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-center space-x-4 p-4 bg-gray-700 rounded-lg">
          <div className="w-12 h-12 bg-gray-600 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-600 rounded w-3/4" />
            <div className="h-3 bg-gray-600 rounded w-1/2" />
          </div>
          <div className="w-20 h-8 bg-gray-600 rounded" />
        </div>
      ))}
    </div>
  ),

  Analytics: () => (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-700 rounded w-1/3" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="bg-gray-700 rounded-lg p-6">
            <div className="space-y-3">
              <div className="h-4 bg-gray-600 rounded w-1/2" />
              <div className="h-8 bg-gray-600 rounded w-2/3" />
              <div className="h-3 bg-gray-600 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  ),

  Social: () => (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-gray-700 rounded-lg p-6">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-gray-600 rounded-full" />
            <div className="flex-1 space-y-3">
              <div className="flex items-center space-x-2">
                <div className="h-4 bg-gray-600 rounded w-24" />
                <div className="h-3 bg-gray-600 rounded w-16" />
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-600 rounded w-full" />
                <div className="h-4 bg-gray-600 rounded w-3/4" />
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-16 h-6 bg-gray-600 rounded" />
                <div className="w-16 h-6 bg-gray-600 rounded" />
                <div className="w-16 h-6 bg-gray-600 rounded" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  ),

  Profile: () => (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center space-x-6">
        <div className="w-24 h-24 bg-gray-700 rounded-full" />
        <div className="flex-1 space-y-3">
          <div className="h-6 bg-gray-700 rounded w-1/3" />
          <div className="h-4 bg-gray-700 rounded w-1/2" />
          <div className="h-4 bg-gray-700 rounded w-2/3" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-gray-700 rounded-lg p-4">
            <div className="space-y-2">
              <div className="h-4 bg-gray-600 rounded w-1/2" />
              <div className="h-6 bg-gray-600 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}