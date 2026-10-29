import React from 'react';
import type { InboxMessage } from '../types/index.ts';

interface NotificationInboxProps {
  messages: InboxMessage[];
  onClear: () => void;
}

export const NotificationInbox: React.FC<NotificationInboxProps> = ({ messages, onClear }) => {
  return (
    <section className="inbox-card" id="notification-inbox-section">
      <div className="inbox-header">
        <div>
          <h2 className="inbox-title">Notification Inbox</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
            Foreground messages received while this tab is open. In-memory only (resets on page reload).
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="inbox-count-badge" id="inbox-message-count">
            {messages.length} {messages.length === 1 ? 'message' : 'messages'}
          </span>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              style={{
                fontSize: '0.75rem',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="empty-state" id="inbox-empty-state">
          <svg
            className="empty-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <h3 className="empty-title">No notifications yet</h3>
          <p className="empty-description">
            When you send a test notification from the Firebase Console while this tab is focused in the
            foreground, it will appear here in real time. Background notifications are displayed
            directly by the browser service worker.
          </p>
        </div>
      ) : (
        <div className="inbox-messages-list" id="inbox-messages-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {messages.map((msg) => (
            <article
              key={msg.id}
              className="inbox-message-item"
              style={{
                padding: '0.875rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.375rem' }}>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  {msg.title}
                </h4>
                <time style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {msg.receivedAt}
                </time>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4, wordBreak: 'break-word' }}>
                {msg.body}
              </p>
              <div style={{ marginTop: '0.5rem', fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                ID: {msg.id}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
