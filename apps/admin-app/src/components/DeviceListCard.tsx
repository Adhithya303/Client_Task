import type { DeviceItem, DeviceListResponse } from '../types/index.ts'

interface DeviceListCardProps {
  deviceData: DeviceListResponse | null
  isLoading: boolean
  error: string | null
  selectedDevice: DeviceItem | null
  onSelectDevice: (device: DeviceItem) => void
  onRefresh: () => void
  pageLimit: number
  pageOffset: number
  onPageChange: (newOffset: number) => void
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return isoString
  }
}

export function DeviceListCard({
  deviceData,
  isLoading,
  error,
  selectedDevice,
  onSelectDevice,
  onRefresh,
  pageLimit,
  pageOffset,
  onPageChange,
}: DeviceListCardProps) {
  const devices = deviceData?.devices || []
  const total = deviceData?.total || 0

  const hasNextPage = pageOffset + pageLimit < total
  const hasPrevPage = pageOffset > 0

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Registered Devices</h2>
          <p className="card-subtitle">
            Devices with tokens saved in MongoDB notify collection ({total} total).
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Refresh Devices'}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          <div>{error}</div>
        </div>
      )}

      {isLoading && devices.length === 0 ? (
        <div className="empty-state">
          <p>Loading registered devices...</p>
        </div>
      ) : devices.length === 0 ? (
        <div className="empty-state">
          <p><strong>No registered devices found.</strong></p>
          <p>
            Open the User App on <a href="http://localhost:5173" target="_blank" rel="noreferrer">http://localhost:5173</a>, click &quot;Enable notifications&quot;, and register a device token.
          </p>
        </div>
      ) : (
        <>
          <div className="device-table-container">
            <table className="device-table">
              <thead>
                <tr>
                  <th>Selection</th>
                  <th>Status</th>
                  <th>Platform</th>
                  <th>Registration ID</th>
                  <th>Masked Token</th>
                  <th>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => {
                  const isSelected =
                    selectedDevice?.registration_id === device.registration_id
                  const isInactive = !device.is_active

                  return (
                    <tr
                      key={device.registration_id}
                      className={isSelected ? 'selected-row' : ''}
                    >
                      <td>
                        <button
                          type="button"
                          className={`btn btn-sm ${
                            isSelected
                              ? 'btn-primary'
                              : 'btn-secondary'
                          }`}
                          onClick={() => onSelectDevice(device)}
                          disabled={isInactive}
                          title={
                            isInactive
                              ? 'Device token was marked inactive by FCM. Device must re-register.'
                              : 'Select this device for sending'
                          }
                        >
                          {isSelected ? 'Selected' : 'Select'}
                        </button>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            device.is_active ? 'badge-active' : 'badge-inactive'
                          }`}
                        >
                          {device.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-platform">{device.platform}</span>
                      </td>
                      <td>
                        <span className="code-snippet" title={device.registration_id}>
                          {device.registration_id}
                        </span>
                      </td>
                      <td>
                        <span className="code-snippet" title="Masked token suffix">
                          {device.token_suffix}
                        </span>
                      </td>
                      <td>
                        <span title={device.last_seen_at}>
                          {formatDate(device.last_seen_at)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <div>
              Showing {devices.length > 0 ? pageOffset + 1 : 0}–
              {Math.min(pageOffset + pageLimit, total)} of {total} devices
            </div>
            <div className="pagination-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onPageChange(Math.max(0, pageOffset - pageLimit))}
                disabled={!hasPrevPage || isLoading}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onPageChange(pageOffset + pageLimit)}
                disabled={!hasNextPage || isLoading}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
