import type { LogEntry } from '../types'

export class LoggerService {
  private logs: LogEntry[] = []
  private subscribers: Set<(logs: LogEntry[]) => void> = new Set()
  private maxLogs = 1000

  log(message: string): void {
    this.addLog('log', message)
  }

  error(message: string): void {
    this.addLog('error', message)
  }

  debug(message: string): void {
    this.addLog('debug', message)
  }

  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  clear(): void {
    this.logs = []
    this.notifySubscribers()
  }

  subscribe(callback: (logs: LogEntry[]) => void): () => void {
    this.subscribers.add(callback)

    callback(this.logs)

    return () => {
      this.subscribers.delete(callback)
    }
  }

  private addLog(type: 'log' | 'error' | 'debug', message: string): void {
    const entry: LogEntry = { type, message, timestamp: Date.now() }

    this.logs.push(entry)

    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    this.notifySubscribers()

    if (type === 'error') {
      console.error(`[${new Date().toISOString()}] ${message}`)
    } else if (type === 'debug') {
      console.debug(`[${new Date().toISOString()}] ${message}`)
    } else {
      console.log(`[${new Date().toISOString()}] ${message}`)
    }
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => {
      callback(this.logs)
    })
  }
}
