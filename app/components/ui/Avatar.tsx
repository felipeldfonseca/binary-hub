'use client'
import React from 'react'
import { User } from 'lucide-react'
// Simple className utility
const cn = (...classes: (string | undefined | null | boolean)[]) => {
  return classes.filter(Boolean).join(' ')
}

interface AvatarProps {
  src?: string
  alt?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  showOnlineIndicator?: boolean
  isOnline?: boolean
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16'
}

const iconSizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8'
}

export function Avatar({ 
  src, 
  alt, 
  size = 'md', 
  className,
  showOnlineIndicator = false,
  isOnline = false
}: AvatarProps) {
  return (
    <div className={cn('relative', className)}>
      <div className={cn(
        'rounded-full overflow-hidden bg-gray-100 flex items-center justify-center',
        sizeClasses[size]
      )}>
        {src ? (
          <img
            src={src}
            alt={alt || 'Avatar'}
            className="h-full w-full object-cover"
          />
        ) : (
          <User 
            className={cn('text-gray-400', iconSizeClasses[size])}
          />
        )}
      </div>
      
      {showOnlineIndicator && (
        <div className={cn(
          'absolute bottom-0 right-0 rounded-full border-2 border-white',
          isOnline ? 'bg-green-500' : 'bg-gray-400',
          size === 'sm' ? 'h-2 w-2' : 'h-3 w-3'
        )} />
      )}
    </div>
  )
}

export default Avatar