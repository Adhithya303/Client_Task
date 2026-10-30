import type { AdminStatus } from '../types/index.ts'

interface StatusCardProps {
  status: AdminStatus | null
  isLoading: boolean
  onRefresh: () => void
}

export function StatusCard({ status, isLoading, onRefresh }: StatusCardProps) {
  if (!status) return null

  const isBackendOk = status.backend === 'reachable'
  const isMongoOk = status.mongodb === 'reachable'
  const isFirebaseInit = status.firebase_admin?.state === 'initialized'

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">System Status</h2>
          <p className="card-subtitle">
            Diagnostics reported by FastAPI backend (<code>GET /api/admin/status</code>).
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? 'Checking...' : 'Refresh Status'}
        </button>
      </div>

      <div className="status-grid">
        {/* Backend API */}
        <div className="status-item">
          <div className="status-item-label">Backend API</div>
          <div className="status-item-value">
            <span className={`status-dot ${isBackendOk ? 'dot-green' : 'dot-red'}`} />
            <span>{status.backend}</span>
          </div>
          <div className="status-item-note">FastAPI service on port 8000</div>
        </div>

        {/* MongoDB */}
        <div className="status-item">
          <div className="status-item-label">MongoDB</div>
          <div className="status-item-value">
            <span className={`status-dot ${isMongoOk ? 'dot-green' : 'dot-red'}`} />
            <span>{status.mongodb}</span>
          </div>
          <div className="status-item-note">
            Database: <code>fcm_notification_demo</code>
          </div>
        </div>

        {/* Firebase Admin SDK */}
        <div className="status-item">
          <div className="status-item-label">Firebase Admin SDK</div>
          <div className="status-item-value">
            <span
              className={`status-dot ${
                isFirebaseInit ? 'dot-green' : 'dot-amber'
              }`}
            />
            <span>
              {isFirebaseInit ? 'Initialized' : 'Unavailable'}
            </span>
          </div>
          <div className="status-item-note">
            {isFirebaseInit ? (
              <span>Credentials loaded via Application Default Credentials.</span>
            ) : (
              <span>{status.firebase_admin?.message || 'Server credentials missing.'}</span>
            )}
          </div>
        </div>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 0 }}>
        <div>
          <strong>Operational Notice:</strong>{' '}
          {status.notice ||
            '"Initialized" indicates server credentials match FIREBASE_PROJECT_ID. It does not verify permission to send, and no notification has been sent yet.'}
        </div>
      </div>
    </div>
  )
}
