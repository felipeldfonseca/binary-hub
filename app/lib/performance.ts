'use client'
import React from 'react'

/**
 * Performance-optimized animation utilities for VERSION 1
 * Focus: 60fps animations, Intersection Observer, CSS-first approach
 */

// Performance monitoring utilities
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private frameCount = 0;
  private lastTime = 0;
  private fps = 60;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startFrameMonitoring(): void {
    const measureFrame = (timestamp: number) => {
      if (this.lastTime) {
        const delta = timestamp - this.lastTime;
        this.fps = Math.round(1000 / delta);
        
        // Warn if FPS drops below 55
        if (this.fps < 55) {
          console.warn(`[Performance] Low FPS detected: ${this.fps}fps`);
        }
      }
      
      this.lastTime = timestamp;
      this.frameCount++;
      
      requestAnimationFrame(measureFrame);
    };
    
    requestAnimationFrame(measureFrame);
  }

  getCurrentFPS(): number {
    return this.fps;
  }
}

// Intersection Observer utilities for scroll-triggered animations
export class ScrollAnimationManager {
  private static observers = new Map<string, IntersectionObserver>();
  
  static createObserver(
    elementId: string, 
    callback: (entry: IntersectionObserverEntry) => void,
    options: IntersectionObserverInit = {}
  ): IntersectionObserver {
    const defaultOptions: IntersectionObserverInit = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
      ...options
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          callback(entry);
        }
      });
    }, defaultOptions);

    this.observers.set(elementId, observer);
    return observer;
  }

  static observeElement(elementId: string, element: Element): void {
    const observer = this.observers.get(elementId);
    if (observer) {
      observer.observe(element);
    }
  }

  static unobserveElement(elementId: string, element: Element): void {
    const observer = this.observers.get(elementId);
    if (observer) {
      observer.unobserve(element);
    }
  }

  static cleanup(elementId: string): void {
    const observer = this.observers.get(elementId);
    if (observer) {
      observer.disconnect();
      this.observers.delete(elementId);
    }
  }
}

// CSS Animation utilities
export const animations = {
  // Typewriter effect with CSS keyframes
  typewriter: {
    animation: 'typewriter 2s steps(40, end), blink-caret 0.75s step-end infinite',
    overflow: 'hidden',
    borderRight: '3px solid #E1FFD9',
    whiteSpace: 'nowrap' as const,
    margin: '0 auto',
    letterSpacing: '0.15em'
  },

  // Staggered reveal animation
  staggerReveal: (delay: number) => ({
    opacity: 0,
    transform: 'translateY(30px)',
    animation: `staggerReveal 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms forwards`
  }),

  // Slide in from direction
  slideIn: (direction: 'left' | 'right' | 'up' | 'down', delay = 0) => ({
    opacity: 0,
    transform: getSlideTransform(direction),
    animation: `slideIn${capitalize(direction)} 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms forwards`
  }),

  // Fade up animation
  fadeUp: (delay = 0) => ({
    opacity: 0,
    transform: 'translateY(20px)',
    animation: `fadeUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms forwards`
  }),

  // Parallax text movement
  parallax: {
    transform: 'translateZ(0)', // Enable hardware acceleration
    willChange: 'transform'
  },

  // Magnetic hover effect
  magneticHover: {
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    willChange: 'transform'
  }
};

// Helper functions
function getSlideTransform(direction: string): string {
  switch (direction) {
    case 'left': return 'translateX(-50px)';
    case 'right': return 'translateX(50px)';
    case 'up': return 'translateY(-50px)';
    case 'down': return 'translateY(50px)';
    default: return 'translateY(30px)';
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Performance-optimized useIntersectionObserver hook
export function useIntersectionObserver(
  elementRef: React.RefObject<Element>,
  callback: (entry: IntersectionObserverEntry) => void,
  options: IntersectionObserverInit = {},
  elementId?: string
) {
  React.useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const id = elementId || `element-${Math.random().toString(36).substr(2, 9)}`;
    const observer = ScrollAnimationManager.createObserver(id, callback, options);
    
    ScrollAnimationManager.observeElement(id, element);

    return () => {
      ScrollAnimationManager.cleanup(id);
    };
  }, [elementRef, callback, options, elementId]);
}

// CSS Keyframes to be injected into the page
export const injectKeyframes = () => {
  if (typeof document === 'undefined') return;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes typewriter {
      from { width: 0 }
      to { width: 100% }
    }

    @keyframes blink-caret {
      from, to { border-color: transparent }
      50% { border-color: #E1FFD9 }
    }

    @keyframes staggerReveal {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes slideInLeft {
      from {
        opacity: 0;
        transform: translateX(-50px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes slideInRight {
      from {
        opacity: 0;
        transform: translateX(50px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes slideInUp {
      from {
        opacity: 0;
        transform: translateY(-50px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes slideInDown {
      from {
        opacity: 0;
        transform: translateY(50px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes fadeUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes shimmer {
      0% {
        background-position: -200% 0;
      }
      100% {
        background-position: 200% 0;
      }
    }

    .shimmer-loading {
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0.1) 25%,
        rgba(255, 255, 255, 0.2) 50%,
        rgba(255, 255, 255, 0.1) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    .magnetic-hover:hover {
      transform: scale(1.05) translateZ(0);
    }

    .parallax-text {
      transform: translateZ(0);
      backface-visibility: hidden;
      perspective: 1000px;
    }
  `;
  
  document.head.appendChild(style);
};

// Loading skeleton components
export const LoadingSkeleton = {
  Text: ({ width = '100%', height = '1rem' }: { width?: string; height?: string }) => {
    return React.createElement('div', {
      className: 'shimmer-loading rounded',
      style: { width, height }
    });
  },

  Card: () => {
    return React.createElement('div', {
      className: 'card animate-pulse'
    }, [
      React.createElement('div', { 
        key: '1',
        className: 'shimmer-loading h-4 w-3/4 mb-3 rounded' 
      }),
      React.createElement('div', { 
        key: '2',
        className: 'shimmer-loading h-3 w-full mb-2 rounded' 
      }),
      React.createElement('div', { 
        key: '3',
        className: 'shimmer-loading h-3 w-5/6 rounded' 
      })
    ]);
  },

  Button: () => {
    return React.createElement('div', {
      className: 'shimmer-loading h-12 w-32 rounded-full'
    });
  }
};

// Performance utilities
export const performanceUtils = {
  // Debounce function for scroll events
  debounce: <T extends (...args: any[]) => void>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  // Throttle function for resize events
  throttle: <T extends (...args: any[]) => void>(
    func: T,
    limit: number
  ): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  // Check if device prefers reduced motion
  prefersReducedMotion: (): boolean => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
};

// Initialize performance monitoring on client side
if (typeof window !== 'undefined') {
  PerformanceMonitor.getInstance().startFrameMonitoring();
  injectKeyframes();
}