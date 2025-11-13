import React, { useMemo, useCallback, useRef, useEffect } from 'react';

/**
 * Performance optimization utilities for React components
 */

// Debounce hook for expensive operations
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Throttle hook for high-frequency events
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastRun = useRef(Date.now());

  return useCallback(
    ((...args) => {
      if (Date.now() - lastRun.current >= delay) {
        callback(...args);
        lastRun.current = Date.now();
      }
    }) as T,
    [callback, delay]
  );
}

// Memoized selector for complex computations
export function useMemoizedSelector<T, R>(
  data: T,
  selector: (data: T) => R,
  dependencies: React.DependencyList = []
): R {
  return useMemo(() => selector(data), [data, ...dependencies]);
}

// Virtual scrolling hook for large lists
export function useVirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5
}: {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}) {
  const [scrollTop, setScrollTop] = React.useState(0);

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex + 1).map((item, index) => ({
      item,
      index: startIndex + index
    }));
  }, [items, startIndex, endIndex]);

  const totalHeight = items.length * itemHeight;

  return {
    visibleItems,
    totalHeight,
    startIndex,
    setScrollTop
  };
}

// Intersection Observer hook for lazy loading
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = React.useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsIntersecting(entry.isIntersecting),
      { threshold: 0.1, ...options }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [ref, options]);

  return isIntersecting;
}

// Optimized image loading hook
export function useOptimizedImage(src: string, placeholder?: string) {
  const [currentSrc, setCurrentSrc] = React.useState(placeholder || '');
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);

  useEffect(() => {
    const img = new Image();
    
    img.onload = () => {
      setCurrentSrc(src);
      setIsLoading(false);
    };
    
    img.onerror = () => {
      setHasError(true);
      setIsLoading(false);
    };
    
    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return { currentSrc, isLoading, hasError };
}

// Performance measurement hook
export function usePerformanceMetrics() {
  const startTime = useRef<number>(0);
  const [metrics, setMetrics] = React.useState<{
    renderTime: number;
    componentMounts: number;
    lastRender: number;
  }>({
    renderTime: 0,
    componentMounts: 0,
    lastRender: 0
  });

  const startMeasure = useCallback(() => {
    startTime.current = performance.now();
  }, []);

  const endMeasure = useCallback(() => {
    const renderTime = performance.now() - startTime.current;
    setMetrics(prev => ({
      renderTime,
      componentMounts: prev.componentMounts + 1,
      lastRender: Date.now()
    }));
  }, []);

  return { metrics, startMeasure, endMeasure };
}

// Optimized list rendering with chunking
export function useChunkedList<T>(
  items: T[],
  chunkSize: number = 50,
  delay: number = 0
) {
  const [visibleCount, setVisibleCount] = React.useState(chunkSize);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const loadMore = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setVisibleCount(prev => Math.min(prev + chunkSize, items.length));
    }, delay);
  }, [chunkSize, delay, items.length]);

  const visibleItems = useMemo(() => {
    return items.slice(0, visibleCount);
  }, [items, visibleCount]);

  const hasMore = visibleCount < items.length;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { visibleItems, hasMore, loadMore };
}

// Memory leak prevention hook
export function useCleanup(cleanupFn: () => void) {
  const cleanupRef = useRef(cleanupFn);
  cleanupRef.current = cleanupFn;

  useEffect(() => {
    return () => cleanupRef.current();
  }, []);
}

// Bundle splitting utility
export function createLazyComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ComponentType
) {
  const LazyComponent = React.lazy(importFn);
  
  const WrappedComponent = React.forwardRef<any, React.ComponentProps<T>>((props, ref) => (
    <React.Suspense 
      fallback={fallback ? React.createElement(fallback) : <div>Loading...</div>}
    >
      <LazyComponent {...props} ref={ref} />
    </React.Suspense>
  ));
  
  WrappedComponent.displayName = `Lazy(${importFn.name || 'Component'})`;
  
  return WrappedComponent;
}

// Resource preloading utility
export function preloadResource(href: string, as: 'script' | 'style' | 'image' | 'font') {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = as;
  
  if (as === 'font') {
    link.crossOrigin = 'anonymous';
  }
  
  document.head.appendChild(link);
}

// Critical CSS injection
export function injectCriticalCSS(css: string) {
  if (typeof window === 'undefined') return;

  const style = document.createElement('style');
  style.textContent = css;
  style.setAttribute('data-critical', 'true');
  document.head.appendChild(style);
}

// Performance observer hook
export function usePerformanceObserver() {
  const [metrics, setMetrics] = React.useState<{
    fcp: number;
    lcp: number;
    cls: number;
    fid: number;
  }>({
    fcp: 0,
    lcp: 0,
    cls: 0,
    fid: 0
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    // First Contentful Paint
    const fcpObserver = new PerformanceObserver(list => {
      const entries = list.getEntriesByType('paint');
      const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
      if (fcpEntry) {
        setMetrics(prev => ({ ...prev, fcp: fcpEntry.startTime }));
      }
    });
    fcpObserver.observe({ entryTypes: ['paint'] });

    // Largest Contentful Paint
    const lcpObserver = new PerformanceObserver(list => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      setMetrics(prev => ({ ...prev, lcp: lastEntry.startTime }));
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // Cumulative Layout Shift
    const clsObserver = new PerformanceObserver(list => {
      let clsValue = 0;
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
      setMetrics(prev => ({ ...prev, cls: prev.cls + clsValue }));
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });

    return () => {
      fcpObserver.disconnect();
      lcpObserver.disconnect();
      clsObserver.disconnect();
    };
  }, []);

  return metrics;
}

// Bundle analysis utility
export function analyzeBundleSize() {
  if (typeof window === 'undefined') return;

  const scripts = Array.from(document.querySelectorAll('script[src]'));
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));

  console.group('Bundle Analysis');
  console.log('Scripts:', scripts.map(s => s.getAttribute('src')));
  console.log('Styles:', styles.map(s => s.getAttribute('href')));
  console.groupEnd();
}

