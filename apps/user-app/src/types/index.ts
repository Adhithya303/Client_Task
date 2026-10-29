export type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export interface BrowserCapability {
  hasNotificationApi: boolean;
  hasServiceWorker: boolean;
  isSecureContext: boolean;
  isFullyCapable: boolean;
  permission: PermissionState;
  permissionLabel: string;
}

export type SetupPhase = 1 | 2 | 3;

export interface PhaseInfo {
  phase: SetupPhase;
  title: string;
  description: string;
  status: 'current' | 'upcoming' | 'completed';
}

/** In-memory received message item for the notification inbox */
export interface InboxMessage {
  id: string;
  title: string;
  body: string;
  receivedAt: string;
  rawPayload?: Record<string, unknown>;
}

/** Token generation status tracking */
export type TokenStatus = 'idle' | 'loading' | 'success' | 'error';
