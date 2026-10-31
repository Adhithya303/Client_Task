import { useState } from 'react'
import { loginWithCredentials } from '../services/api.ts'

interface ConnectCardProps {
  onConnect: (token: string) => Promise<void>
  isConnecting: boolean
  error: string | null
}

export function ConnectCard({ onConnect, isConnecting, error }: ConnectCardProps) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
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

  return (
    <div className="card connect-card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Admin Authentication</h2>
          <p className="card-subtitle">
            Sign in with admin credentials to obtain a secure OAuth2 JWT access token.
          </p>
        </div>
      </div>

      <div className="alert alert-info">
        <div>
          <strong>In-Memory Session Security:</strong> Your access token is held in browser application memory only.
          It is never saved to localStorage, cookies, or browser storage. Refreshing or closing the tab will clear the session.
        </div>
      </div>

      {(error || validationError) && (
        <div className="alert alert-danger" role="alert">
          <div>{error || validationError}</div>
        </div>
      )}

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
              placeholder="Enter admin password"
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
            Admin users are provisioned via <code>python -m app.cli create-admin --username admin</code>.
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
    </div>
  )
}
