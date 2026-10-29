import React, { useState } from 'react';
import type { TokenStatus, PermissionState } from '../types/index.ts';
import type { BackendRegistrationStatus } from './DeviceRegistrationCard.tsx';

interface NotificationActionCardProps {
  onEnableNotifications: () => void;
  onRetryBackend: () => void;
  tokenStatus: TokenStatus;
  backendStatus: BackendRegistrationStatus;
  token: string | null;
  errorMessage: string | null;
  backendErrorMessage: string | null;
  permission: PermissionState;
  isConfigComplete: boolean;
}

export const NotificationActionCard: React.FC<NotificationActionCardProps> = ({
  onEnableNotifications,
  onRetryBackend,
  tokenStatus,
  backendStatus,
  token,
  errorMessage,
  backendErrorMessage,
  permission,
  isConfigComplete,
}) => {
  const [showToken, setShowToken] = useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const handleCopy = async () => {
    if (!token) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(token);
        setCopyFeedback('Copied to clipboard!');
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = token;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopyFeedback('Copied to clipboard!');
      }
    } catch {
      setCopyFeedback('Failed to copy. Please select and copy manually.');
    }
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  const isBlocked = permission === 'denied';
  const isPending = tokenStatus === 'loading';
  const hasToken = tokenStatus === 'success' && Boolean(token);
  const isSavingBackend = backendStatus === 'saving';
  const isBackendFailed = backendStatus === 'error';
  const isBackendSaved = backendStatus === 'saved';

  return (
    <section className="action-card" id="notification-action-section">
      <div className="action-bar">
        <button
          type="button"
          className="btn-primary"
          id="btn-enable-notifications"
          onClick={onEnableNotifications}
          disabled={isPending || isSavingBackend || isBlocked || !isConfigComplete}
          aria-disabled={isPending || isSavingBackend || isBlocked || !isConfigComplete}
        >
          {isPending ? (
            'Enabling notifications...'
          ) : isSavingBackend ? (
            'Saving token to backend...'
          ) : hasToken ? (
            'Refresh FCM Token'
          ) : isBlocked ? (
            'Notifications Blocked'
          ) : (
            'Enable notifications'
          )}
        </button>

        {isBackendFailed && (
          <button
            type="button"
            className="btn-primary"
            id="btn-retry-backend-registration"
            onClick={onRetryBackend}
            style={{ backgroundColor: '#dc2626' }}
          >
            Retry registration
          </button>
        )}

        <span className="action-explanation" id="action-explanation-text">
          {isBackendSaved ? (
            <span style={{ color: 'var(--success-text)', fontWeight: 600 }}>
              ✓ FCM token active &amp; registered in MongoDB!
            </span>
          ) : isBackendFailed ? (
            <span style={{ color: 'var(--danger-text)' }}>
              Token ready — database registration failed.
            </span>
          ) : hasToken ? (
            <span style={{ color: 'var(--accent)', fontWeight: 500 }}>
              FCM token active. Registering with backend...
            </span>
          ) : isBlocked ? (
            <span style={{ color: 'var(--danger-text)' }}>
              Notifications blocked in site settings.
            </span>
          ) : !isConfigComplete ? (
            <span>Configuration incomplete. Check .env.local.</span>
          ) : (
            <span>Requests permission, retrieves token, and registers with FastAPI.</span>
          )}
        </span>
      </div>

      {errorMessage && (
        <div className="notice-box notice-danger" style={{ marginTop: '1rem' }} id="action-error-box">
          <strong>Notification error:</strong> {errorMessage}
          <div style={{ marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn-link"
              onClick={onEnableNotifications}
              style={{
                fontSize: '0.8125rem',
                color: 'var(--danger-text)',
                textDecoration: 'underline',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Click here to retry
            </button>
          </div>
        </div>
      )}

      {isBackendFailed && backendErrorMessage && (
        <div className="notice-box notice-danger" style={{ marginTop: '1rem' }} id="backend-action-error-box">
          <strong>Database registration error:</strong> {backendErrorMessage}
        </div>
      )}

      {hasToken && token && (
        <div
          className="token-details-card"
          id="token-display-box"
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              FCM Registration Token
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn-secondary"
                id="btn-toggle-token"
                onClick={() => setShowToken(!showToken)}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.625rem',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                {showToken ? 'Hide token' : 'Show token'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                id="btn-copy-token"
                onClick={handleCopy}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.625rem',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Copy token
              </button>
            </div>
          </div>

          {copyFeedback && (
            <div style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '0.375rem' }}>
              {copyFeedback}
            </div>
          )}

          {showToken ? (
            <div style={{ marginTop: '0.75rem' }}>
              <textarea
                readOnly
                value={token}
                rows={3}
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          ) : (
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Token masked for security. Click "Show token" or "Copy token" to copy it.
            </div>
          )}
        </div>
      )}
    </section>
  );
};
