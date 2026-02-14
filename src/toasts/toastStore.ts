import { createStore } from 'solid-js/store'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

const [toasts, setToasts] = createStore<Toast[]>([])

export const useToastStore = () => {
  return { toasts }
}

export function showToast(message: string, type: ToastType = 'info') {
  const id = Math.random().toString(36).slice(2, 9)
  setToasts(prev => [...prev, { id, message, type }])

  setTimeout(() => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, 3000)
}
