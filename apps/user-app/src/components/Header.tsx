import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="dashboard-header">
      <div className="header-top">
        <h1 className="dashboard-title">Push Notification Demo</h1>
        <span className="header-badge" id="app-phase-badge">
          Part 1: Scaffold &amp; Interface
        </span>
      </div>
      <p className="dashboard-description">
        A client application for receiving real-time push notifications via Firebase Cloud Messaging (FCM)
        and synchronizing device tokens with a shared FastAPI + MongoDB backend.
      </p>
    </header>
  );
};
