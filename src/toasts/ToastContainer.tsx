import { For } from 'solid-js'
import { Portal } from 'solid-js/web'
import { useToastStore } from './toastStore'

export function ToastContainer() {
  const { toasts } = useToastStore()

  return (
    <Portal>
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          display: 'flex',
          'flex-direction': 'column',
          gap: '10px',
          'z-index': 9999
        }}
      >
        <For each={toasts}>
          {toast => (
            <div
              style={{
                background: toast.type === 'error' ? '#e53e3e' : toast.type === 'success' ? '#38a169' : '#3182ce',
                color: 'white',
                padding: '10px 20px',
                'border-radius': '4px',
                'box-shadow': '0 2px 5px rgba(0,0,0,0.2)',
                'min-width': '200px',
                animation: 'fadeIn 0.3s ease-in-out'
              }}
            >
              {toast.message}
            </div>
          )}
        </For>
      </div>
    </Portal>
  )
}
