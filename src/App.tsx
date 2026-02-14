import { lazy, Suspense } from 'solid-js'
import './App.css'

const IDE = lazy(() => import('./IDE').then(m => ({ default: m.IDE })))
const ToastContainer = lazy(() => import('./toasts/ToastContainer').then(m => ({ default: m.ToastContainer })))

export default function App() {
  return (
    <>
      <Suspense
        fallback={
          <div style={{ height: '100vh', display: 'flex', 'align-items': 'center', 'justify-content': 'center' }}>
            Loading Editor...
          </div>
        }
      >
        <IDE />
      </Suspense>
      <Suspense>
        <ToastContainer />
      </Suspense>
    </>
  )
}
