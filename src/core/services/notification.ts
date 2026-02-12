/**
 * NotificationService - Toast notifications with auto-dismiss.
 */

import type { Toast } from '../types'

export class NotificationService {
  private toasts: Map<string, Toast> = new Map()
  private subscribers: Set<(toasts: Toast[]) => void> = new Set()
  private idCounter = 0

  /**
   * Show info notification.
   */
  info(message: string, duration: number = 3000): string {
    return this.show(message, 'info', duration)
  }

  /**
   * Show error notification.
   */
  error(message: string, duration: number = 5000): string {
    return this.show(message, 'error', duration)
  }

  /**
   * Show success notification.
   */
  success(message: string, duration: number = 3000): string {
    return this.show(message, 'success', duration)
  }

  /**
   * Show notification with type.
   */
  show(message: string, type: 'info' | 'error' | 'success', duration?: number): string {
    const id = `toast-${this.idCounter++}`

    const toast: Toast = {
      id,
      message,
      type,
      duration,
    }

    this.toasts.set(id, toast)
    this.notifySubscribers()

    // Auto-dismiss if duration set
    if (duration && duration > 0) {
      setTimeout(() => {
        this.dismiss(id)
      }, duration)
    }

    return id
  }

  /**
   * Dismiss notification by ID.
   */
  dismiss(id: string): void {
    this.toasts.delete(id)
    this.notifySubscribers()
  }

  /**
   * Dismiss all notifications.
   */
  dismissAll(): void {
    this.toasts.clear()
    this.notifySubscribers()
  }

  /**
   * Get all active toasts.
   */
  getToasts(): Toast[] {
    return Array.from(this.toasts.values())
  }

  /**
   * Subscribe to toast changes.
   * Returns unsubscribe function.
   */
  subscribe(callback: (toasts: Toast[]) => void): () => void {
    this.subscribers.add(callback)
    // Immediately call with current toasts
    callback(this.getToasts())
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback)
    }
  }

  /**
   * Private: notify all subscribers.
   */
  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => {
      callback(this.getToasts())
    })
  }
}
