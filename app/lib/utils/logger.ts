// Frontend logging utility
interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
  timestamp: string;
  userAgent?: string;
  url?: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private log(level: LogEntry['level'], message: string, data?: any) {
    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined
    };

    // Console logging in development
    if (this.isDevelopment) {
      const consoleMethod = level === 'debug' ? 'log' : level;
      console[consoleMethod](`[${level.toUpperCase()}]`, message, data || '');
    }

    // Send to external logging service in production (optional)
    if (!this.isDevelopment && (level === 'error' || level === 'warn')) {
      this.sendToLoggingService(entry);
    }
  }

  private sendToLoggingService(entry: LogEntry) {
    // Optional: Send logs to external service like LogRocket, Sentry, etc.
    // For now, just store in sessionStorage for debugging
    try {
      const logs = JSON.parse(sessionStorage.getItem('app-logs') || '[]');
      logs.push(entry);
      // Keep only last 100 entries
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }
      sessionStorage.setItem('app-logs', JSON.stringify(logs));
    } catch (error) {
      // Ignore storage errors
    }
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, data?: any) {
    this.log('error', message, data);
  }

  // Get logs from sessionStorage (for debugging)
  getLogs(): LogEntry[] {
    try {
      return JSON.parse(sessionStorage.getItem('app-logs') || '[]');
    } catch {
      return [];
    }
  }

  // Clear logs
  clearLogs() {
    try {
      sessionStorage.removeItem('app-logs');
    } catch {
      // Ignore storage errors
    }
  }
}

export const logger = new Logger();