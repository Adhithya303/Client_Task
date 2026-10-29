import React from 'react';

export type BackendRegistrationStatus = 'idle' | 'saving' | 'saved' | 'error';

interface DeviceRegistrationCardProps {
  status: BackendRegistrationStatus;
  registrationId: string | null;
  errorMessage: string | null;
  tokenGenerated: boolean;
  onRetry: () => void;
}

export const DeviceRegistrationCard: React.FC<DeviceRegistrationCardProps> = ({
  status,
  registrationId,
  errorMessage,
  tokenGenerated,
  onRetry,
}) => {
  let badgeClass = 'badge-neutral';
  let badgeText = 'Not connected';

  if (status === 'saved') {
    badgeClass = 'badge-success';
    badgeText = 'Saved to MongoDB';
  } else if (status === 'saving') {
    badgeClass = 'badge-warning';
    badgeText = 'Saving token...';
  } else if (status === 'error') {
    badgeClass = 'badge-danger';
    badgeText = 'Registration failed';
  } else if (tokenGenerated) {
    badgeClass = 'badge-neutral';
    badgeText = 'Pending save';
  }

  return (
    <div className="card" id="device-registration-card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Device Registration</h2>
          <p className="card-subtitle">FastAPI &amp; MongoDB sync</p>
        </div>
        <span className={`badge ${badgeClass}`} id="device-registration-badge">
          <span className="badge-dot" />
          {badgeText}
        </span>
      </div>

      <div className="status-content">
        <div className="detail-row">
          <span className="detail-label">FCM Token</span>
          <span className="detail-val" id="backend-token-status">
            {tokenGenerated ? 'Generated' : 'None'}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">MongoDB Persistence</span>
          <span className="detail-val" id="backend-db-status">
            {status === 'saved'
              ? '✓ Persisted in notify collection'
              : status === 'saving'
              ? 'Saving in progress...'
              : status === 'error'
              ? '✕ Failed'
              : 'Not connected'}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Registration ID</span>
          <span className="detail-val" id="backend-registration-id">
            {registrationId ? registrationId : '—'}
          </span>
        </div>
      </div>

      {status === 'saved' && (
        <div className="notice-box notice-info" id="backend-saved-note">
          <strong>Persisted in MongoDB:</strong> Your device registration document is saved in the{' '}
          <code>notify</code> collection of database <code>fcm_notification_demo</code>. Repeated
          registrations with this token are atomic and idempotent.
        </div>
      )}

      {status === 'saving' && (
        <div className="notice-box notice-info" id="backend-saving-note">
          <strong>Connecting to FastAPI:</strong> Sending your token to <code>/api/devices/register</code> for
          database upsert...
        </div>
      )}

      {status === 'error' && (
        <div className="notice-box notice-danger" id="backend-error-note">
          <strong>Token ready — database registration failed:</strong>{' '}
          {errorMessage || 'Failed to connect to backend.'}
          <div style={{ marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn-link"
              onClick={onRetry}
              style={{
                fontSize: '0.8125rem',
                color: 'var(--danger-text)',
                textDecoration: 'underline',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                fontWeight: 600,
              }}
            >
              Retry registration with backend
            </button>
          </div>
        </div>
      )}

      {status === 'idle' && (
        <div className="notice-box notice-info" id="backend-idle-note">
          <strong>Registration flow:</strong> When you enable notifications, your real FCM token will
          be automatically posted to FastAPI (<code>http://localhost:8000</code>) and stored in MongoDB.
        </div>
      )}
    </div>
  );
};
