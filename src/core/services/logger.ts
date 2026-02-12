/**
 * LoggerService - Structured logging with subscriber pattern.
 */

import type { LogEntry } from '../types'

export class LoggerService {
  private logs: LogEntry[] = []
  private subscribers: Set<(logs: LogEntry[]) => void> = new Set()
  private maxLogs = 1000

  /**
   * Log a message at info level.
   */
  log(message: string): void {
    this.addLog('log', message)
  }

  /**
   * Log a message at error level.
   */
  error(message: string): void {
    this.addLog('error', message)
  }

  /**
   * Log a message at debug level.
   */
  debug(message: string): void {
    this.addLog('debug', message)
  }

  /**
   * Get all logs.
   */
  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  /**
   * Clear all logs.
   */
  clear(): void {
    this.logs = []
    this.notifySubscribers()
  }

  /**
   * Subscribe to log changes.
   * Returns unsubscribe function.
   */
  subscribe(callback: (logs: LogEntry[]) => void): () => void {
    this.subscribers.add(callback)
    // Immediately call with current logs
    callback(this.logs)
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback)
    }
  }

  /**
   * Private: add log entry and notify subscribers.
   */
  private addLog(type: 'log' | 'error' | 'debug', message: string): void {
    const entry: LogEntry = {
      type,
      message,
      timestamp: Date.now(),
    }

    this.logs.push(entry)

    // Keep max logs limit
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    this.notifySubscribers()

    // Also log to console for development
    if (type === 'error') {
      console.error(`[${new Date().toISOString()}] ${message}`)
    } else if (type === 'debug') {
      console.debug(`[${new Date().toISOString()}] ${message}`)
    } else {
      console.log(`[${new Date().toISOString()}] ${message}`)
    }
  }

  /**
   * Private: notify all subscribers.
   */
  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => {
      callback(this.logs)
    })
  }
}
