import { useEditor } from './hooks/useEditor'
import './App.css'

export function App() {
  const { state, send, context, isLoading, isEditing, isSaving, isExecuting, isError } = useEditor()

  return (
    <div className="app">
      <header className="app-header">
        <h1>web-node-ide</h1>
        <div className="status">
          {isLoading && <span className="status-badge loading">Loading...</span>}
          {isSaving && <span className="status-badge saving">Saving...</span>}
          {isExecuting && <span className="status-badge executing">Running...</span>}
          {isError && <span className="status-badge error">Error</span>}
          {context?.isDirty && <span className="status-badge dirty">Modified</span>}
        </div>
      </header>

      <main className="app-main">
        <div className="editor-controls">
          <button
            onClick={() => send({ type: 'OPEN', path: 'main.js' })}
            disabled={!isEditing && !state?.matches('idle')}
            className="btn btn-primary"
          >
            📁 Open
          </button>
          <button
            onClick={() => send({ type: 'SAVE' })}
            disabled={!context?.isDirty}
            className="btn btn-primary"
          >
            💾 Save
          </button>
          <button
            onClick={() => send({ type: 'RUN' })}
            disabled={!isEditing}
            className="btn btn-primary"
          >
            ▶ Run
          </button>
        </div>

        <div className="editor-area">
          <textarea
            className="code-editor"
            value={context?.content ?? ''}
            onChange={(e) => send({ type: 'MODIFY', content: e.target.value })}
            placeholder="Write your code here..."
            disabled={!isEditing}
          />
        </div>

        {isError && (
          <div className="error-panel">
            <p className="error-message">{context?.error}</p>
            <button onClick={() => send({ type: 'RESET_ERROR' })} className="btn btn-small">
              Dismiss
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
