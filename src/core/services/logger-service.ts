/**
 * LoggerService for application logging.
 * Writes to console + maintains in-memory buffer for debugging.
 */

import type { LoggerService } from './types';

export interface LogEntry {
  level: 'log' | 'warn' | 'error';
  args: unknown[];
  timestamp: number;
}

export class LoggerServiceImpl implements LoggerService {
  private buffer: LogEntry[] = [];
  private maxBufferSize = 1000; // Keep last 1000 entries

  private addEntry(level: 'log' | 'warn' | 'error', args: unknown[]): void {
    this.buffer.push({
      level,
      args,
      timestamp: Date.now()
    });

    // Keep buffer size under control
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer = this.buffer.slice(-this.maxBufferSize);
    }
  }

  log(...args: unknown[]): void {
    console.log(...args);
    this.addEntry('log', args);
  }

  warn(...args: unknown[]): void {
    console.warn(...args);
    this.addEntry('warn', args);
  }

  error(...args: unknown[]): void {
    console.error(...args);
    this.addEntry('error', args);
  }

  getBuffer(): LogEntry[] {
    return [...this.buffer];
  }

  clearBuffer(): void {
    this.buffer = [];
  }
}
