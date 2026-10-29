import React from 'react';
import type { PhaseInfo } from '../types/index.ts';

const PHASES: PhaseInfo[] = [
  {
    phase: 1,
    title: 'Scaffold & Interface',
    description: 'React dashboard, browser capability checks, permission status, and UI states.',
    status: 'completed',
  },
  {
    phase: 2,
    title: 'Firebase Integration',
    description: 'Service worker setup, VAPID key configuration, real FCM token retrieval, foreground/background handlers.',
    status: 'completed',
  },
  {
    phase: 3,
    title: 'Backend Registration',
    description: 'FastAPI + MongoDB device persistence, idempotency, and live notification handling.',
    status: 'current',
  },
];

export const SetupProgress: React.FC = () => {
  return (
    <section className="progress-card" aria-labelledby="progress-heading">
      <div className="progress-header">
        <h2 className="progress-title" id="progress-heading">
          Project Setup Progress
        </h2>
        <span className="progress-subtext">Step 3 of 3 Active</span>
      </div>
      <div className="progress-steps">
        {PHASES.map((p) => (
          <div
            key={p.phase}
            className={`progress-step ${p.status === 'current' ? 'active' : ''}`}
            id={`setup-step-${p.phase}`}
          >
            <div className="progress-step-header">
              <span className="step-number">Phase {p.phase}</span>
              <span
                className={`step-status-tag ${
                  p.status === 'completed'
                    ? 'active'
                    : p.status === 'current'
                    ? 'active'
                    : 'pending'
                }`}
                style={
                  p.status === 'completed'
                    ? { backgroundColor: '#ecfdf5', color: '#065f46' }
                    : undefined
                }
              >
                {p.status === 'completed'
                  ? 'Completed'
                  : p.status === 'current'
                  ? 'In Progress'
                  : 'Pending'}
              </span>
            </div>
            <h3 className="step-name">{p.title}</h3>
            <p className="step-desc">{p.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
