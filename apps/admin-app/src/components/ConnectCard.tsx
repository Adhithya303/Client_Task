import { useState } from 'react'
import { loginWithCredentials } from '../services/api.ts'

interface ConnectCardProps {
  onConnect: (keyOrToken: string) => Promise<void>
  isConnecting: boolean
  error: string | null
}

export function ConnectCard({ onConnect, isConnecting, error }: ConnectCardProps) {
  const [authMode, setAuthMode] = useState<'credentials' | 'token'>('credentials')
  
  // Credentials state
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  
  // Direct key state
  const [keyInput, setKeyInput] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedUser = username.trim()
    const trimmedPass = password.trim()
    if (!trimmedUser || !trimmedPass) {
      setValidationError('Please enter both username and password.')
      return
    }
    setValidationError(null)
    setIsLoggingIn(true)
    try {
      const token = await loginWithCredentials(trimmedUser, trimmedPass)
      await onConnect(token)
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleDirectKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = keyInput.trim()
    if (!trimmed) {
      setValidationError('Please enter your Admin API Key or JWT.')
      return
    }
    setValidationError(null)
    await onConnect(trimmed)
  }

  return (
    <div className="card connect-card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Admin Authentication</h2>
          <p className="card-subtitle">
            Sign in with admin credentials to obtain a secure OAuth2 JWT access token or use an existing key.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          type="button"
          className={`btn ${authMode === 'credentials' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '8px 12px', fontSize: '0.9rem' }}
          onClick={() => {
            setAuthMode('credentials')
            setValidationError(null)
          }}
        >
          Username &amp; Password (OAuth2)
        </button>
        <button
          type="button"
          className={`btn ${authMode === 'token' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '8px 12px', fontSize: '0.9rem' }}
          onClick={() => {
            setAuthMode('token')
            setValidationError(null)
          }}
        >
          API Key / Token
        </button>
      </div>

      <div className="alert alert-info">
        <div>
          <strong>In-Memory Session Security:</strong> Your authentication token is held in browser application memory only.
          It is never saved to localStorage, cookies, or browser storage. Refreshing or closing the tab will clear the session.
        </div>
      </div>

      {(error || validationError) && (
        <div className="alert alert-danger" role="alert">
          <div>{error || validationError}</div>
        </div>
      )}

      {authMode === 'credentials' ? (
        <form onSubmit={handleCredentialsSubmit}>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label htmlFor="admin-username-input" className="form-label">
              Admin Username
            </label>
            <input
              id="admin-username-input"
              type="text"
              className="form-input"
              placeholder="e.g. admin"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                if (validationError) setValidationError(null)
              }}
              disabled={isConnecting || isLoggingIn}
              autoComplete="username"
              spellCheck="false"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="admin-password-input" className="form-label">
              Admin Password
            </label>
            <div className="password-input-wrapper">
              <input
                id="admin-password-input"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="Enter admin password or ADMIN_API_KEY"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (validationError) setValidationError(null)
                }}
                disabled={isConnecting || isLoggingIn}
                autoComplete="current-password"
                spellCheck="false"
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
              Provisioned via <code>python -m app.cli create-admin</code> or configured via <code>ADMIN_API_KEY</code>.
            </p>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px' }}
            disabled={isConnecting || isLoggingIn || !username.trim() || !password.trim()}
          >
            {isConnecting || isLoggingIn ? 'Authenticating...' : 'Sign In with OAuth2'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleDirectKeySubmit}>
          <div className="form-group">
            <label htmlFor="admin-key-input" className="form-label">
              Admin API Key (<code>X-Admin-Key</code>) or JWT
            </label>
            <div className="password-input-wrapper">
              <input
                id="admin-key-input"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="Paste your ADMIN_API_KEY from backend/.env or JWT token"
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
            style={{ width: '100%', marginTop: '8px' }}
            disabled={isConnecting || !keyInput.trim()}
          >
            {isConnecting ? 'Verifying with Backend...' : 'Connect to Backend'}
          </button>
        </form>
      )}
    </div>
  )
}
