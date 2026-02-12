/**
 * NotificationService for user feedback.
 * Uses simple toast-style notifications.
 */

import type { NotificationService } from './types';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  timestamp: number;
}

export class NotificationServiceImpl implements NotificationService {
  private toasts: Map<string, Toast> = new Map();
  private listeners: Set<(toasts: Toast[]) => void> = new Set();
  private autoDismissTime = 5000; // 5 seconds

  subscribe(listener: (toasts: Toast[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(type: 'success' | 'error' | 'info', message: string): void {
    const id = `${type}-${Date.now()}-${Math.random()}`;
    const toast: Toast = {
      id,
      type,
      message,
      timestamp: Date.now()
    };

    this.toasts.set(id, toast);
    this.broadcast();

    // Auto-dismiss after delay
    setTimeout(() => {
      this.toasts.delete(id);
      this.broadcast();
    }, this.autoDismissTime);
  }

  private broadcast(): void {
    const toastArray = Array.from(this.toasts.values());
    for (const listener of this.listeners) {
      listener(toastArray);
    }
  }

  success(message: string): void {
    this.notify('success', message);
  }

  error(message: string): void {
    this.notify('error', message);
  }

  info(message: string): void {
    this.notify('info', message);
  }
}
