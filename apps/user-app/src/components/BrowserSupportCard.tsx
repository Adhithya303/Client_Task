import React from 'react';
import type { BrowserCapability } from '../types';

interface BrowserSupportCardProps {
  capabilities: BrowserCapability;
}

export const BrowserSupportCard: React.FC<BrowserSupportCardProps> = ({ capabilities }) => {
  const { hasNotificationApi, hasServiceWorker, isSecureContext, isFullyCapable } = capabilities;

  return (
    <div className="card" id="browser-support-card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Browser Support</h2>
          <p className="card-subtitle">Local browser capability checks</p>
        </div>
        <span
          className={`badge ${isFullyCapable ? 'badge-success' : 'badge-warning'}`}
          id="browser-support-badge"
        >
          <span className="badge-dot" />
          {isFullyCapable ? 'Prerequisites Met' : 'Missing Requirements'}
        </span>
      </div>

      <ul className="capability-list" aria-label="Browser capability status">
        <li className="capability-item" id="check-notification-api">
          <span className="capability-label">
            <span>Notification API</span>
          </span>
          <span
            className={`capability-indicator ${
              hasNotificationApi ? 'indicator-pass' : 'indicator-fail'
            }`}
          >
            {hasNotificationApi ? '✓ Supported' : '✕ Unsupported'}
          </span>
        </li>

        <li className="capability-item" id="check-service-worker">
          <span className="capability-label">
            <span>Service Workers</span>
          </span>
          <span
            className={`capability-indicator ${
              hasServiceWorker ? 'indicator-pass' : 'indicator-fail'
            }`}
          >
            {hasServiceWorker ? '✓ Available' : '✕ Unavailable'}
          </span>
        </li>

        <li className="capability-item" id="check-secure-context">
          <span className="capability-label">
            <span>Secure Context (HTTPS / localhost)</span>
          </span>
          <span
            className={`capability-indicator ${
              isSecureContext ? 'indicator-pass' : 'indicator-fail'
            }`}
          >
            {isSecureContext ? '✓ Secure' : '✕ Insecure Context'}
          </span>
        </li>
      </ul>

      <div className="notice-box notice-info" id="fcm-support-distinction-note">
        <strong>Important note on FCM:</strong> Passing these capability checks confirms standard web
        notification prerequisites. However, it does <em>not</em> guarantee that Firebase Cloud
        Messaging (FCM) will operate. FCM also requires outbound internet access to Google's messaging
        endpoints, a valid VAPID key, and active Firebase project credentials configured in Part 2.
      </div>
    </div>
  );
};
