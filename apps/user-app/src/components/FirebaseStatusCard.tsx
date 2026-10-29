import React from 'react';
import type { AppConfig } from '../config/env.ts';

interface FirebaseStatusCardProps {
  config: AppConfig;
  isMessagingSupported: boolean | null;
  swRegistered: boolean;
  tokenGenerated: boolean;
}

export const FirebaseStatusCard: React.FC<FirebaseStatusCardProps> = ({
  config,
  isMessagingSupported,
  swRegistered,
  tokenGenerated,
}) => {
  const { isFirebaseConfigComplete, missingFirebaseKeys, firebase } = config;

  let badgeText = 'Configuration incomplete';
  let badgeClass = 'badge-warning';

  if (!isFirebaseConfigComplete) {
    badgeText = 'Configuration incomplete';
    badgeClass = 'badge-warning';
  } else if (isMessagingSupported === false) {
    badgeText = 'Messaging unsupported';
    badgeClass = 'badge-danger';
  } else if (tokenGenerated) {
    badgeText = 'Connected — token active';
    badgeClass = 'badge-success';
  } else if (swRegistered) {
    badgeText = 'Service worker ready';
    badgeClass = 'badge-success';
  } else {
    badgeText = 'Configuration ready — connection not tested';
    badgeClass = 'badge-neutral';
  }

  return (
    <div className="card" id="firebase-status-card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Firebase Setup</h2>
          <p className="card-subtitle">FCM client SDK &amp; service worker</p>
        </div>
        <span className={`badge ${badgeClass}`} id="firebase-status-badge">
          <span className="badge-dot" />
          {badgeText}
        </span>
      </div>

      <div className="status-content">
        <div className="detail-row">
          <span className="detail-label">Project ID</span>
          <span className="detail-val" id="firebase-project-id">
            {firebase.projectId || '—'}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">FCM SDK support</span>
          <span className="detail-val" id="firebase-messaging-support">
            {isMessagingSupported === null
              ? 'Checking...'
              : isMessagingSupported
              ? '✓ Supported'
              : '✕ Unsupported'}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Messaging service worker</span>
          <span className="detail-val" id="firebase-sw-status">
            {swRegistered ? '✓ Registered (/)' : 'Pending registration'}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">FCM Registration Token</span>
          <span className="detail-val" id="firebase-token-status">
            {tokenGenerated ? '✓ Generated' : 'Not obtained'}
          </span>
        </div>
      </div>

      {!isFirebaseConfigComplete ? (
        <div className="notice-box notice-warning" id="firebase-missing-note">
          <strong>Missing variables:</strong>
          <ul className="missing-list" id="firebase-missing-list">
            {missingFirebaseKeys.map((name) => (
              <li key={name}>
                <code>{name}</code>
              </li>
            ))}
          </ul>
          Add them to <code>apps/user-app/.env.local</code> and restart <code>npm run dev</code>.
        </div>
      ) : isMessagingSupported === false ? (
        <div className="notice-box notice-danger">
          <strong>FCM not supported:</strong> Firebase Cloud Messaging is not supported in this browser
          or environment (e.g. Firefox private mode or older browser engine).
        </div>
      ) : tokenGenerated ? (
        <div className="notice-box notice-info" id="firebase-ready-note">
          <strong>FCM token active:</strong> A real push token has been generated using your project's
          credentials and public VAPID key. You can now test push delivery from the Firebase Console.
        </div>
      ) : (
        <div className="notice-box notice-info" id="firebase-ready-note">
          <strong>Configuration ready:</strong> Required values are present in <code>.env.local</code>.
          Click "Enable notifications" to complete worker registration and retrieve your FCM token.
        </div>
      )}
    </div>
  );
};
