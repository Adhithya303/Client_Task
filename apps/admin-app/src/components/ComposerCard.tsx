import { useState } from 'react'
import type { DeviceItem, SendNotificationResponse } from '../types/index.ts'

interface ComposerCardProps {
  selectedDevice: DeviceItem | null
  onSend: (payload: { registration_id: string; title: string; body: string }) => Promise<SendNotificationResponse>
  isSending: boolean
}

const MAX_TITLE_LENGTH = 100
const MAX_BODY_LENGTH = 1000

export function ComposerCard({ selectedDevice, onSend, isSending }: ComposerCardProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [lastSuccess, setLastSuccess] = useState<SendNotificationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setLastSuccess(null)
    setError(null)
    setValidationError(null)

    if (!selectedDevice) {
      setValidationError('Please select an active target device from the device list above.')
      return
    }

    if (!selectedDevice.is_active) {
      setValidationError('The selected device is inactive and cannot receive notifications.')
      return
    }

    const trimmedTitle = title.trim()
    const trimmedBody = body.trim()

    if (!trimmedTitle) {
      setValidationError('Title cannot be empty or whitespace only.')
      return
    }

    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      setValidationError(`Title cannot exceed ${MAX_TITLE_LENGTH} characters.`)
      return
    }

    if (!trimmedBody) {
      setValidationError('Message body cannot be empty or whitespace only.')
      return
    }

    if (trimmedBody.length > MAX_BODY_LENGTH) {
      setValidationError(`Message body cannot exceed ${MAX_BODY_LENGTH} characters.`)
      return
    }

    try {
      const response = await onSend({
        registration_id: selectedDevice.registration_id,
        title: trimmedTitle,
        body: trimmedBody,
      })
      setLastSuccess(response)
    } catch (err: unknown) {
      // Keep form content so operator does not lose their typed message
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    }
  }

  const isFormValid =
    selectedDevice &&
    selectedDevice.is_active &&
    title.trim().length > 0 &&
    title.trim().length <= MAX_TITLE_LENGTH &&
    body.trim().length > 0 &&
    body.trim().length <= MAX_BODY_LENGTH

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Notification Composer</h2>
          <p className="card-subtitle">
            Compose and dispatch a push notification to the selected device via Firebase Cloud Messaging.
          </p>
        </div>
      </div>

      {/* Target Device Selection Summary */}
      <div className="form-group">
        <label className="form-label">Target Device</label>
        {selectedDevice ? (
          <div className="alert alert-info" style={{ marginBottom: '0.5rem' }}>
            <div>
              <strong>Target:</strong>{' '}
              <span className="code-snippet">{selectedDevice.registration_id}</span>{' '}
              (Token suffix: <span className="code-snippet">{selectedDevice.token_suffix}</span>, Platform:{' '}
              <code>{selectedDevice.platform}</code>)
              {!selectedDevice.is_active && (
                <span style={{ color: 'var(--danger-text)', marginLeft: '0.5rem' }}>
                  (Inactive - device must re-register)
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="alert alert-warning" style={{ marginBottom: '0.5rem' }}>
            <div>
              No device selected. Please click &quot;Select&quot; on an active device in the table above.
            </div>
          </div>
        )}
      </div>

      {/* Success Banner */}
      {lastSuccess && (
        <div className="alert alert-success" role="status">
          <div>
            <strong>Accepted by FCM:</strong> Firebase accepted message for routing.
            <div style={{ marginTop: '0.25rem' }}>
              <strong>FCM Message ID:</strong>{' '}
              <code className="code-snippet">{lastSuccess.message_id}</code>
            </div>
            <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem' }}>
              Note: Acceptance by FCM confirms handoff to Google for delivery routing. It does not verify device receipt or display.
            </div>
          </div>
        </div>
      )}

      {/* Error / Validation Banner */}
      {(error || validationError) && (
        <div className="alert alert-danger" role="alert">
          <div>
            <strong>Error:</strong> {error || validationError}
            {error && error.includes('timed out') && (
              <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem' }}>
                <strong>Warning:</strong> An ambiguous timeout may mean FCM already accepted the request.
                Retrying immediately risks sending a duplicate notification.
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSend}>
        {/* Title Field */}
        <div className="form-group">
          <label htmlFor="composer-title" className="form-label">
            <span>Notification Title</span>
            <span className="char-counter">
              {title.length} / {MAX_TITLE_LENGTH}
            </span>
          </label>
          <input
            id="composer-title"
            type="text"
            className="form-input"
            placeholder="e.g. Server Maintenance Notice"
            value={title}
            maxLength={MAX_TITLE_LENGTH}
            onChange={(e) => {
              setTitle(e.target.value)
              if (validationError) setValidationError(null)
            }}
            disabled={isSending}
          />
        </div>

        {/* Body Field */}
        <div className="form-group">
          <label htmlFor="composer-body" className="form-label">
            <span>Notification Message Body</span>
            <span className="char-counter">
              {body.length} / {MAX_BODY_LENGTH}
            </span>
          </label>
          <textarea
            id="composer-body"
            className="form-textarea"
            placeholder="e.g. Database maintenance scheduled for 02:00 UTC."
            value={body}
            maxLength={MAX_BODY_LENGTH}
            onChange={(e) => {
              setBody(e.target.value)
              if (validationError) setValidationError(null)
            }}
            disabled={isSending}
            rows={3}
          />
        </div>

        {/* Live Notification Preview */}
        <div className="preview-card">
          <div className="preview-label">Live Push Notification Preview</div>
          <div className="preview-bubble">
            <div className="preview-icon">🔔</div>
            <div className="preview-content">
              <div className="preview-title">
                {title.trim() || 'Notification Title'}
              </div>
              <div className="preview-body">
                {body.trim() || 'Notification message text will appear here...'}
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!isFormValid || isSending}
        >
          {isSending ? 'Sending to FCM...' : 'Send Notification'}
        </button>
      </form>
    </div>
  )
}
