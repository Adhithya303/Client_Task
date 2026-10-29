import React from 'react';
import type { PermissionState } from '../types';

interface PermissionCardProps {
  permission: PermissionState;
  permissionLabel: string;
  isSecureContext: boolean;
}

export const PermissionCard: React.FC<PermissionCardProps> = ({
  permission,
  permissionLabel,
  isSecureContext,
}) => {
  const getBadgeClass = () => {
    switch (permission) {
      case 'granted':
        return 'badge-success';
      case 'denied':
        return 'badge-danger';
      case 'default':
        return 'badge-neutral';
      case 'unsupported':
      default:
        return 'badge-warning';
    }
  };

  return (
    <div className="card" id="permission-status-card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Notification Permission</h2>
          <p className="card-subtitle">Browser notification grant status</p>
        </div>
        <span className={`badge ${getBadgeClass()}`} id="permission-badge">
          <span className="badge-dot" />
          {permissionLabel}
        </span>
      </div>

      <div className="status-content">
        <div className="detail-row">
          <span className="detail-label">Raw browser value</span>
          <span className="detail-val" id="raw-permission-value">
            {permission === 'unsupported' ? 'undefined' : `"${permission}"`}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Display status</span>
          <span className="detail-val" id="mapped-permission-label">
            {permissionLabel}
          </span>
        </div>
      </div>

      {permission === 'denied' && (
        <div className="notice-box notice-danger" id="guidance-denied">
          <strong>Notifications are blocked:</strong> Your browser has denied permission for this
          site. To enable notifications, click the site settings / lock icon in your browser's
          address bar, reset the <em>Notifications</em> permission to "Allow", and reload the page.
        </div>
      )}

      {permission === 'default' && (
        <div className="notice-box notice-info" id="guidance-default">
          <strong>Permission not requested:</strong> In compliance with best practices, notification
          permissions are never prompted automatically. Permission will be requested only when you
          click "Enable notifications" once Firebase is integrated in Part 2.
        </div>
      )}

      {permission === 'granted' && (
        <div className="notice-box notice-info" id="guidance-granted">
          <strong>Permission granted:</strong> Your browser allows notifications from this origin.
          Once the Firebase messaging service worker and credentials are added in Part 2, a real FCM
          token will be retrieved.
        </div>
      )}

      {permission === 'unsupported' && (
        <div className="notice-box notice-warning" id="guidance-unsupported">
          <strong>Notifications unavailable:</strong> This browser does not expose the Notification
          API. Try a current version of Chrome, Edge, or Firefox on desktop or Android.
        </div>
      )}

      {!isSecureContext && (
        <div className="notice-box notice-warning notice-stacked" id="guidance-insecure">
          <strong>Insecure context:</strong> Browsers only allow push on HTTPS or
          <code>http://localhost</code>. Open the app at <code>http://localhost:5173</code> rather
          than a LAN IP address.
        </div>
      )}
    </div>
  );
};
