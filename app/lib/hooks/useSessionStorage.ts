import { useState, useEffect } from 'react'

export function useSessionStorage<T>(key: string, initialValue: T) {
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(initialValue)
  const [isClient, setIsClient] = useState(false)

  // Check if we're on the client side
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Get value from sessionStorage on client side
  useEffect(() => {
    if (isClient) {
      try {
        const item = sessionStorage.getItem(key)
        if (item) {
          // Try to parse as JSON, fallback to string
          try {
            setStoredValue(JSON.parse(item))
          } catch {
            setStoredValue(item as T)
          }
        }
      } catch (error) {
        console.error(`Error reading sessionStorage key "${key}":`, error)
      }
    }
  }, [key, isClient])

  // Function to set value
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      
      // Save to sessionStorage if on client side
      if (isClient) {
        const stringValue = typeof valueToStore === 'string' ? valueToStore : JSON.stringify(valueToStore)
        sessionStorage.setItem(key, stringValue)
      }
    } catch (error) {
      console.error(`Error setting sessionStorage key "${key}":`, error)
    }
  }

  // Function to remove value
  const removeValue = () => {
    try {
      setStoredValue(initialValue)
      if (isClient) {
        sessionStorage.removeItem(key)
      }
    } catch (error) {
      console.error(`Error removing sessionStorage key "${key}":`, error)
    }
  }

  return [storedValue, setValue, removeValue, isClient] as const
} 