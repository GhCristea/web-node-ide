import type { Toast } from '../types'

export class NotificationService {
  private toasts: Map<string, Toast> = new Map()
  private subscribers: Set<(toasts: Toast[]) => void> = new Set()
  private idCounter = 0

  info(message: string, duration: number = 3000): string {
    return this.show(message, 'info', duration)
  }

  error(message: string, duration: number = 5000): string {
    return this.show(message, 'error', duration)
  }

  success(message: string, duration: number = 3000): string {
    return this.show(message, 'success', duration)
  }

  show(message: string, type: 'info' | 'error' | 'success', duration?: number): string {
    const id = `toast-${this.idCounter++}`

    const toast: Toast = { id, message, type, duration }

    this.toasts.set(id, toast)
    this.notifySubscribers()

    if (duration && duration > 0) {
      setTimeout(() => {
        this.dismiss(id)
      }, duration)
    }

    return id
  }

  dismiss(id: string): void {
    this.toasts.delete(id)
    this.notifySubscribers()
  }

  dismissAll(): void {
    this.toasts.clear()
    this.notifySubscribers()
  }

  getToasts(): Toast[] {
    return Array.from(this.toasts.values())
  }

  subscribe(callback: (toasts: Toast[]) => void): () => void {
    this.subscribers.add(callback)

    callback(this.getToasts())

    return () => {
      this.subscribers.delete(callback)
    }
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => {
      callback(this.getToasts())
    })
  }
}
