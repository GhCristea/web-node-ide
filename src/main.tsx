import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { initializeServices } from './core/services'
import './index.css'

// Initialize all core services before rendering
initializeServices()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
