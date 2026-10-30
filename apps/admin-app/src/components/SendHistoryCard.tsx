import type { SendHistoryItem } from '../types/index.ts'

interface SendHistoryCardProps {
  history: SendHistoryItem[]
  onClearHistory: () => void
}

export function SendHistoryCard({ history, onClearHistory }: SendHistoryCardProps) {
  if (history.length === 0) return null

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Session Send History</h2>
          <p className="card-subtitle">
            Recent notifications dispatched during this session (in-memory only; resets on page reload).
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onClearHistory}
        >
          Clear History
        </button>
      </div>

      <div className="history-list">
        {history.map((item) => (
          <div key={item.id} className="history-item">
            <div className="history-item-left">
              <div className="history-item-title">
                {item.title}
              </div>
              <div className="history-item-meta">
                <span>Target: <code>{item.deviceSuffix}</code></span>
                <span>•</span>
                <span>{item.timestamp}</span>
                {item.messageId && (
                  <>
                    <span>•</span>
                    <span className="code-snippet">ID: {item.messageId.split('/').pop()}</span>
                  </>
                )}
              </div>
              {item.error && (
                <div style={{ color: 'var(--danger-text)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                  {item.error}
                </div>
              )}
            </div>

            <div>
              <span
                className={`badge ${
                  item.status === 'accepted' ? 'badge-active' : 'badge-inactive'
                }`}
              >
                {item.status === 'accepted' ? 'Accepted by FCM' : 'Dispatch Failed'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
