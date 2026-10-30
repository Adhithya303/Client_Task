import { useState } from 'react'

interface ConnectCardProps {
  onConnect: (key: string) => Promise<void>
  isConnecting: boolean
  error: string | null
}

export function ConnectCard({ onConnect, isConnecting, error }: ConnectCardProps) {
  const [keyInput, setKeyInput] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = keyInput.trim()
    if (!trimmed) {
      setValidationError('Please enter your Admin API Key.')
      return
    }
    setValidationError(null)
    await onConnect(trimmed)
  }

  return (
    <div className="card connect-card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Connect to Backend</h2>
          <p className="card-subtitle">
            Enter the shared local Admin API key to access device management and sending APIs.
          </p>
        </div>
      </div>

      <div className="alert alert-info">
        <div>
          <strong>In-Memory Key Security:</strong> Your key is stored in browser application memory only.
          It is never saved to localStorage, cookies, or browser storage. Refreshing or closing the tab will disconnect the session.
        </div>
      </div>

      {(error || validationError) && (
        <div className="alert alert-danger" role="alert">
          <div>{error || validationError}</div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="admin-key-input" className="form-label">
            Admin API Key (<code>X-Admin-Key</code>)
          </label>
          <div className="password-input-wrapper">
            <input
              id="admin-key-input"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder="Paste your ADMIN_API_KEY from backend/.env"
              value={keyInput}
              onChange={(e) => {
                setKeyInput(e.target.value)
                if (validationError) setValidationError(null)
              }}
              disabled={isConnecting}
              autoComplete="current-password"
              spellCheck="false"
              autoFocus
            />
            <button
              type="button"
              className="toggle-password-btn"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="form-hint">
            Configured in <code>backend/.env</code> as <code>ADMIN_API_KEY</code>.
          </p>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%' }}
          disabled={isConnecting || !keyInput.trim()}
        >
          {isConnecting ? 'Verifying with Backend...' : 'Connect to Backend'}
        </button>
      </form>
    </div>
  )
}
