interface HeaderProps {
  isConnected: boolean
  onDisconnect?: () => void
}

export function Header({ isConnected, onDisconnect }: HeaderProps) {
  return (
    <header className="admin-header">
      <div className="header-row">
        <div>
          <div className="title-group">
            <h1 className="admin-title">FCM Push Admin Console</h1>
            <span className="header-badge">Admin App (Port 5174)</span>
          </div>
          <p className="admin-subtitle">
            Local operator console to view registered devices and request push notification dispatch through FastAPI.
          </p>
        </div>

        {isConnected && onDisconnect && (
          <div className="header-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onDisconnect}
              title="Clear admin key and return to connect screen"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
